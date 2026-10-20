using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using Csharp.Models;

namespace Csharp.Helper
{
            public static class FileManager
            {
                        public static string user = "Administrator";
                        public static string baseUrl = "ftp://172.16.16.84/Documento/ProjetoGerado/";
                        public static string password = "hotelh.123";
                        public static FtpWebResponse FtpWebGet(string url, string method)
                             => (FtpWebResponse)FtpWebConnector(url, method).GetResponse();
                        public static FtpWebRequest FtpWebConnector(string url, string method)
                        {          if(url!="")
                                   {
                                      if(url[url.Length-1].ToString()=="/")
                                       url = url.RemoveLastChar_();
                                   }
                                   
                                    var path = $"{baseUrl}{url}";
                                    FtpWebRequest ftpRequest = (FtpWebRequest)FtpWebRequest.Create($"{baseUrl}{url}");
                                    ftpRequest.Method = method;
                                    ftpRequest.Credentials = new NetworkCredential(user, password);
                                    return ftpRequest;
                        }
                        public static void CreateDir(string url)
                        {
                                    var pathStr = "";
                                    var pathUrl = url.Split("/");
                                    var subPath="";
                                    var dirExist= GetAllFtps("");
                                    var listFile=new List<infoPath>();
                                    var dirSubExist= new List<infoPath>();
                                    for (var i = 0; i < pathUrl.Length; i++)
                                    {
                                         var dirProjeto=dirExist.Where(e=>e.NameFile==pathUrl[0]);
                                         if(dirProjeto.Count()>0)
                                         {
                                                   listFile= dirSubExist=GetAllFtps(pathUrl[0]);
                                                   subPath=pathUrl[i+1];
                                                   pathStr +=pathUrl[0]+"/"+pathUrl[i+1] + "/";
                                                   i=i+1;
                                         }
                                         else
                                           pathStr += pathUrl[i] + "/";
                                        var isSubPath=listFile.Where(e=>e.NameFile==subPath);
                                        if(isSubPath.Count()==0 && !subPath.Contains("."))
                                        FtpWebGet(pathStr, WebRequestMethods.Ftp.MakeDirectory);
                                    }
                        }
                        public static List<infoPath> FileExist(string _baseUrl)
                        {
                              var fileNames=new List<infoPath>();
                               Console.WriteLine("----------- --------- --------");
                               var listFile=GetAllFtps(_baseUrl);
                                
                                   listFile.ForEach(r=>{
                                        
                                        
                                         var arrName=r.NameFile.Split(" ");
                                        
                                         if(arrName.Count()>1)
                                         {
                                             var _nameFile=arrName.Count()>2?r.NameFile.Split(" ")[2]:r.NameFile.Split(" ")[1];
                                           
                                             fileNames.Add(new infoPath{NameFile=_nameFile});

                                         }
                                         else
                                         {
                                          fileNames.Add(new infoPath{NameFile=r.NameFile.Split(" ")[0]});
                                              
                                         }
                                    });
                                    return fileNames;
                        }
                        public static void Upload(string url, string textContent)
                        {
                            
                                 
                                   var arrUrl=url.Split("/");
                                  
                                 
                                   var _baseUrl=url.Replace("/"+arrUrl[arrUrl.Length-1],"");
                                   var fileNames =FileExist(_baseUrl);
                                  
                                   
                                    var fileExist= fileNames.Where(r=>r.NameFile==arrUrl[arrUrl.Length-1]);
                                    Console.WriteLine(fileExist.Count() + "----Osvaldo");
                                    if(fileExist.Count()==0)
                                    {
                                      var request = FtpWebConnector(url, WebRequestMethods.Ftp.UploadFile);
                                      byte[] fileContents = Encoding.ASCII.GetBytes(textContent); ;

                                      request.ContentLength = fileContents.Length;
                                      using (Stream requestStream = request.GetRequestStream())
                                    {
                                                requestStream.Write(fileContents, 0, fileContents.Length);
                                    }
                                    }
                        }
                        public static List<infoPath> GetAllFtps(string url)
                        {
                                    try
                                    {
                                                FtpWebResponse response = FtpWebGet($"{url}", WebRequestMethods.Ftp.ListDirectoryDetails);
                                                StreamReader streamReader = new StreamReader(response.GetResponseStream());
                                                List<infoPath> directories = new List<infoPath>();
                                                var line = streamReader.ReadLine();
                                                while (!string.IsNullOrEmpty(line))
                                                {

                                                            var lineArr = line.Split('/');
                                                            line = lineArr[lineArr.Count() - 1];
                                                            line = line.Replace("       ", "/");
                                                            line = line.Replace("/   ", "/");
                                                            //line=line.Replace(" ","/");
                                                            var lines = line.Split('/');
                                                            var infoPaths = new infoPath()
                                                            {
                                                                        Categoria = lines[1],
                                                                        dataCriacao = lines[0],
                                                                        NameFile = lines[2],
                                                            };
                                                            directories.Add(infoPaths);
                                                            line = streamReader.ReadLine();
                                                }

                                                // streamReader.Close();
                                                return directories;
                                    }
                                    catch(Exception ex)
                                    {
                                         CreateDir(url);
                                                return default;
                                    }
                        }


            }
}