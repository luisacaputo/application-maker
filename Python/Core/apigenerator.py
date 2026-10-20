import shutil

from os import path
from pathlib import os
import fileinput


def fileChangeWord(path, oldword, newWord):
    for line in fileinput.input(path, inplace=True):
        line = line.replace(oldword, newWord)
        print(line, end='')

class ApiGenerator(object):
    def __init__(self, project_name=None,):
        self.__default_path = os.path.abspath('Projects')
        self.__default_project_name = 'APItemplate'
        self.path_name = None
        self.project_name = project_name

    def CloneTemplate(self):
        try:
            self.project_name = self.project_name.replace(' ','')
            self.project_name = self.project_name if len(self.project_name) > 0  else self.__default_project_name

            self.path_name = path.join(self.__default_path, self.project_name) if len(self.__default_path.replace(' ','')) > 0 else path.join(self.__default_path, self.project_name)

            if path.exists(self.path_name):
                raise Exception("This Project name already exists, please find another name to your project.")

            ## Copying the template API to project path
            shutil.copytree(path.abspath('template'), self.path_name)

            self.__Change_Default_Words()
            return self.path_name
        except Exception as ex:
            raise ex

    def __Change_Default_Words(self):
        try:
            if not path.exists(self.path_name):
                return Exception('The specific path was not found.')

            # Starting Change words
            filePath = path.join(self.path_name,'docker-compose.yml')
            fileChangeWord(filePath, 'templateContainerName', self.project_name.lower())
            fileChangeWord(filePath, 'templateImageName', self.project_name.lower())

            return True
        except Exception as ex:
            raise ex
