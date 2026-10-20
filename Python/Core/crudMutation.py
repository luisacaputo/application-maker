import os
import graphene

from .apigenerator import ApiGenerator, fileChangeWord


class DatabaseType(graphene.Enum):
    SQLSERVER = 1
    MYSQL = 2
    POSTGRESQL = 3
    SQLITE = 4


    @property
    def value(self):
        if self == DatabaseType.SQLSERVER:
            return 'SQLSERVER'
        elif self == DatabaseType.MYSQL:
            return 'MYSQL'
        elif self == DatabaseType.POSTGRESQL:
            return 'POSTGRESQL'
        else:
            return 'SQLITE'

    @property
    def description(self):
        if self == DatabaseType.SQLSERVER:
            return 'It is used for Microsoft SQL Server Databases'
        elif self == DatabaseType.MYSQL:
            return 'It is used for MYSQL Databases'
        elif self == DatabaseType.POSTGRESQL:
            return 'It is used for POSTGRESQL Databases'
        else:
            return 'It is used for SQLITE Databases'


class Project(graphene.ObjectType):
  projectName = graphene.String(required=True)
  dbType = DatabaseType(required=True)
  dbHost = graphene.String(required=True)
  dbUserName = graphene.String(required=True)
  dbPassword = graphene.String(required=True)
  dbName = graphene.String(required=True)
  dbHostPort = graphene.String()
  createDockerImage = graphene.Boolean(default_value=False)


class CreateProjectMutation(graphene.ClientIDMutation):
  class Input:
    projectName = graphene.String(required=True)
    dbType = DatabaseType(required=True)
    dbHost = graphene.String(required=True)
    dbUserName = graphene.String(required=True)
    dbPassword = graphene.String(required=True)
    dbName = graphene.String(required=True)
    dbHostPort = graphene.Int()
    createDockerImage = graphene.Boolean(default_value=False)

  data = graphene.Field(Project)
  success = graphene.Boolean(default_value=False)

  @classmethod
  def mutate_and_get_payload(cls, root, info, **kwargs):
    data = Project(**kwargs)

    projectPath = ApiGenerator(project_name=data.projectName).CloneTemplate()

    # # Starting Change words
    filePath = os.path.join(projectPath, 'Core', 'settings.py')
    fileChangeWord(filePath, 'SQLITE', data.dbType.value)

    filePath = os.path.join(projectPath, 'Core', 'dbConnector.py')
    cls.ChangeDatabaseSettings(filePath, data)
    filePath = os.path.join(projectPath, '.env')
    cls.ChangeDatabaseSettings(filePath, data)

    if data.createDockerImage:
      os.system(f'cd {projectPath}/ && docker-compose up -d --build')

    return CreateProjectMutation(data=data, success=True)

  @classmethod
  def ChangeDatabaseSettings(cls, filePath, data):
    fileChangeWord(filePath, 'NEW_DB_HOST', data.dbHost)
    fileChangeWord(filePath, 'NEW_DB_USER', data.dbUserName)
    fileChangeWord(filePath, 'NEW_DB_NAME', data.dbName)
    fileChangeWord(filePath, 'NEW_DB_PASSWORD', data.dbPassword)
    fileChangeWord(filePath, 'NEW_DB_PORT', str(data.dbHostPort))
