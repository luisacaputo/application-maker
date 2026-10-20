using System;
using System.Collections.Generic;
using System.Data.SqlClient;
using System.IO;
using System.Linq;
using Csharp.Helper;
using Csharp.Models;
using Newtonsoft.Json;
using Dapper;

namespace Csharp
{
            public static class QuerySQL
            {
                        private static string server { get; set; }
                        private static string database { get; set; }
                        private static string senha { get; set; }
                        private static List<SQL>  listTable = new List<SQL>();
                        private static List<SQL>  listDataBase = new List<SQL>();
                        private static List<Fields>  listField = new List<Fields>();
                        private static List<SQL>  listFieldPrivileges = new List<SQL>();
                        private static List<FieldPrimaryKey>  listFieldPrimaryKey = new List<FieldPrimaryKey>();
                        private static List<FieldForeignKey>  listFieldForeignKey = new List<FieldForeignKey>();

                        public static SqlConnection conn => connectSQL();
                      

        public static SqlConnection connectSQL()
        {
            var db=database==null?"master":database;
            var serve=server==null?"172.16.16.53":server;
            var password=senha==null?"snirdb!2020":senha;
            //Console.WriteLine($"Data Source={serve};Initial Catalog={db};User ID=sa;Password={password};MultipleActiveResultSets=True;");
           return new SqlConnection($"Data Source={serve};Initial Catalog={db};User ID=sa;Password={password};MultipleActiveResultSets=True;");
        }
                        public static Dictionary<string, string> mapTypes = new Dictionary<string, string> { { "String", "string" },
            { "string", "String" },
            { "Int", "int" },
            { "time", "DateTime" },
            { "date", "DateTime" },
            { "Date", "DateTime" },
            { "int identity", "int" },
            { "Double", "double" },
            { "double", "Float" },
            { "bool", "Boolean" },
            { "Float", "float" },
            { "Bool", "bool" },
            { "DateTime", "DateTime" },
            { "varchar", "string" },
            { "datetime", "DateTime" },
            { "float", "double" },
            { "int", "int" },
            { "bit", "bool" },
            { "text", "string" },
            { "money", "double" },
            { "nvarchar", "string" },
             { "sysname", "string" },
            { "datetime2", "DateTime" },
            { "ntext", "string" },
            { "datetimeoffset", "DateTime" },
            { "bigint identity", "int" },
            { "bigint", "int" },
            { "real", "double" },
            { "varbinary", "string" }

        };
                   
                        public static List<string> sqlQuery = JsonConvert.DeserializeObject<List<string>>(File.ReadAllText("Query.json"));

                        public static List<SQL> allDataBase(List<string> config)
                        {
                                    server = config[1];
                                    //database=config[2];
                                    senha = config[3];
                                    var list = new List<SQL>();
                                    switch (config[0])
                                    {
                                                case "SqlServer":
                                                            list = conn.Query<SQL>(sqlQuery[2]).ToList();
                                                            break;
                                                case "PostGreSQL":
                                                            break;
                                                case "Mysq":
                                                            break;
                                    }
                                    return list;
                        }
                        public static List<SQL> allTable(string db = null)
                        {
                                    database = db;
                                    var  lists = conn.Query<SQL>(sqlQuery[3]).ToList();
                                    return lists;
                        }
                        public static List<Fields> allField(string provedor, string tabela)
                        {
                                    var list = new List<Fields>();
                                    switch (provedor)
                                    {
                                                case "SqlServer":
                                                            if(!listField.Any())
                                                            {
                                                                listField = conn.Query<Fields>($"{sqlQuery[4]}").ToList();
                                                                Console.WriteLine(listField.Count()+"chegei");
                                                                conn.Close();
                                                            }
                                                            break;
                                                case "r":
                                                            break;
                                                case "m":
                                                            break;
                                                case "k":
                                                            break;
                                    }
                                    return listField;
                        }
                        public static List<FieldForeignKey> allFieldForeignKey()
                        {
                                    //var list = new List<FieldForeignKey>();
                                    if(!listFieldForeignKey.Any())
                                      listFieldForeignKey = conn.Query<FieldForeignKey>(sqlQuery[0]).ToList();
                                    return listFieldForeignKey;
                        }
                        public static List<SQL> allFieldPrivileges()
                        {
                                    var list = new List<SQL>();

                                    return default;
                        }
                        public static List<FieldPrimaryKey> allFieldPrimaryKey()
                        {
                                    //var list = new List<FieldPrimaryKey>();
                                    if(!listFieldPrimaryKey.Any())
                                     listFieldPrimaryKey = conn.Query<FieldPrimaryKey>(sqlQuery[1]).ToList();
                                    return listFieldPrimaryKey;
                        }

                        public static void CreateFile(string caminho, string conteudo)
                        {           
                                   var path="";
                                   var pathDir=caminho.Split("\\");
                              
                                    Console.WriteLine($"path:{caminho},tamanho:{pathDir.Length}");
                                    var fileName=caminho.Split("/")[1];
                                    //Console.WriteLine(pathDir);
                                    //[0] [string]:"C:\\Users\\Osvaldo\\3D Objects\\Projecto\\C#\\ISS\\application-maker-api\\nameProjecto"
                                   if(pathDir.Length==1)
                                    path=pathDir[0].Split("/")[0]+"/"+pathDir[0].Split("/")[1];
                                   if(pathDir.Length>1)
                                    path=pathDir[0]+"/"+pathDir[pathDir.Length-1].Split("/")[0];
                                     //Console.WriteLine(path);
                                    FileManager.CreateDir(path);
                                    if(pathDir.Length==1)
                                    FileManager.Upload($"{pathDir[0]}",conteudo);
                                    else
                                    FileManager.Upload($"{path}/{fileName}",conteudo);
                                    // FileStream fs = File.Create(caminho);
                                    // StreamWriter sws = new StreamWriter(fs);
                                    // sws.WriteLine(conteudo);
                                    // sws.Flush();
                                    // sws.Close();
                                    // fs.Close();
                        }
                        public static string MapTypes(string str)
                        {

                                    if (string.IsNullOrEmpty(str)) return null;

                                    str = str.Replace(".", "");
                                    return mapTypes.FirstOrDefault(x => x.Key == str).Value;
                        }


            }
}