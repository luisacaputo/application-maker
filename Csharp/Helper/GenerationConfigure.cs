using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

using Csharp.Models;

namespace Csharp.Helper
{
            public static class GenerationConfigure
            {
                        public static string solutionPath = GlobalRootPath;
                        public static readonly string GlobalRootPath = BackFolder(AppDomain.CurrentDomain.BaseDirectory, 5) + "\\";
                        public static string BackFolder(string path, int n)
                        {
                                    for (int i = 0; i < n; i++)
                                                path = Directory.GetParent(path).FullName;
                                    return path;
                        }
                        
                        public static List<SQL> GenerationCsharp(string table,string nameProject)
                        {
                                    string pp = "\"";
                                    string _propName = "";
                                    string _mapping="";
                                    var list = new List<SQL>();
                                    //var dir=new List<string>(){"DbConfig","Helper","Service","Controllers","Models","Mappings","Interface","Repositorie"};
                                    var fields = QuerySQL.allField("SqlServer", table).Where(e=>e.TABLE_NAME==table).ToList();
                                    var fieldForeignKeys = QuerySQL.allFieldForeignKey();
                                    var fieldPrimaryKeys = QuerySQL.allFieldPrimaryKey();
                                    Console.WriteLine(fieldPrimaryKeys.Count+"Chegei"+fieldForeignKeys.Count);
                                    //foreach(var i in dir)
                                      //CreateDir($"{GlobalRootPath}{nameProject}/{i}");
                                    // var rootModel = @$"{GlobalRootPath}{nameProject}/Models";
                                    // var files = Directory.GetFiles(rootModel).Select(s => new
                                    // {
                                    //             Name = s.Split("\\").LastOrDefault().Replace(".cs", ""),
                                    //             Path = s,
                                    //             Content = File.ReadAllLines(s)
                                    // }).ToList();
                                    fields.ForEach(o =>
                                    {
                                                var _enc = " {get;set;} ";
                                                var type = QuerySQL.MapTypes(o.DATA_TYPE);
                                                type=type==""?"string":type;
                                                var fieldReferenceTable = fieldForeignKeys.Where(e => e.PrimaryTableName == table).ToList();
                                                var fieldForeignKey = fieldForeignKeys.Where(e => e.ReferenceColumnName == o.COLUMN_NAME & e.ReferenceTableName == table).FirstOrDefault();
                                                var fieldPrimaryKey = fieldPrimaryKeys.Where(e => e.column_name == o.COLUMN_NAME & e.table_name == table).FirstOrDefault();
                                                if (fieldForeignKey != null)
                                                {
                                                            var _columnName = o.COLUMN_NAME.RemoveLastChar();
                                                            var _F = $"[ForeignKey('{o.COLUMN_NAME}')]\n";
                                                            _propName += $"public {type} {o.COLUMN_NAME} {_enc}\n";
                                                            _mapping+=$"builder.Property(x => x.{o.COLUMN_NAME}).HasColumnType('{o.DATA_TYPE.ToUpper()}');\n";
                                                            _propName += $"{_F} public virtual {fieldForeignKey.PrimaryTableName} {_columnName} {_enc}\n";
                                                            //var fileExist = files.Where(ff => ff.Name == fieldForeignKey.PrimaryTableName).FirstOrDefault();
                                                }
                                                else if (fieldPrimaryKey != null)
                                                {
                                                            _mapping+=$"builder.HasKey(x => x.{o.COLUMN_NAME});\n builder.Property(x => x.{o.COLUMN_NAME}).HasDefaultValueSql('(newid())').HasColumnType('{o.DATA_TYPE.ToUpper()}');\n";
                                                            _propName += $"[Key]\n public {type} {o.COLUMN_NAME} {_enc}\n";
                                                }
                                                else if (fieldReferenceTable.Count > 0)
                                                {
                                                   fieldReferenceTable.ForEach(e =>
                                                   {
                                                               //var _F = $"[InverseProperty('{table}')]\n";
                                                               if(!_propName.Contains($"\n public virtual ICollection<{e.ReferenceTableName}> {e.ReferenceTableName} {_enc}\n"))
                                                               _propName += $"\n public virtual ICollection<{e.ReferenceTableName}> {e.ReferenceTableName} {_enc}\n";
                                                              // var fileExist = files.Where(ff => ff.Name == e.ReferenceTableName).FirstOrDefault();
                                                   });
                                                }
                                                else
                                                {
                                                            _mapping+=$"builder.Property(x => x.{o.COLUMN_NAME}).HasColumnType('{o.DATA_TYPE.ToUpper()}');\n";
                                                            _propName += $"public {type} {o.COLUMN_NAME} {_enc}\n";
                                                }
                                    });
                                    table=newTable(table);

                                    var tmpModel = File.ReadAllText($"Template/.Net Core/Rest/tmpModel.txt");
                                    var tmpIRepository = File.ReadAllText($"Template/.Net Core/Rest/tmpIRepository.txt");
                                    var tmpRepository = File.ReadAllText($"Template/.Net Core/Rest/tmpRepository.txt");
                                    var tmpMapping = File.ReadAllText($"Template/.Net Core/Rest/tmpMapping.txt");
                                    var tmpController = File.ReadAllText($"Template/.Net Core/Rest/tmpController.txt");
                                    tmpModel = tmpModel.Replaces(new Dictionary<string, string>() {{ "/*<propNames>*/", _propName }, { "'", pp }, { @"\", "" },  { "tableName", table }, { "nameProjecto", nameProject } });
                                    tmpIRepository = tmpIRepository.Replaces(new Dictionary<string, string>() { { @"\", "" }, { "'", pp }, { "propNames", _propName }, { "tableName", table }, { "nameProjecto", nameProject } });
                                    tmpRepository = tmpRepository.Replaces(new Dictionary<string, string>() {{ "'", pp }, { @"\", "" },  { "propNames", _propName }, { "tableName", table }, { "nameProjecto", nameProject } });
                                    tmpMapping = tmpMapping.Replaces(new Dictionary<string, string>() { { "/*<mapping>*/", _mapping },{ @"\", "" }, { "'", pp }, { "tableName", table }, { "nameProjecto", nameProject } });
                                    tmpController = tmpController.Replaces(new Dictionary<string, string>() { { @"\", "" }, { "'", pp }, { "propNames", _propName }, { "tableName", table }, { "nameProjecto", nameProject } });
                                    QuerySQL.CreateFile($@"{nameProject}\Models/{table}.cs", tmpModel);
                                    QuerySQL.CreateFile($@"{nameProject}\Interface/I{table}Repository.cs", tmpIRepository);
                                    QuerySQL.CreateFile($@"{nameProject}\Repositorie/{table}Repository.cs", tmpRepository);
                                    QuerySQL.CreateFile($@"{nameProject}\Mappings/{table}Mapping.cs", tmpMapping);
                                    QuerySQL.CreateFile($@"{nameProject}\Controllers/{table}Controller.cs", tmpController);
                                    
                                    return default;
                        }
                                                public static string newTable(string table)
                        {
                            if(table.Contains("/"))
                                    {
                                      
                                         var arrStr=table.Split("/");
                                         if(arrStr.Length>2)
                                          table=arrStr[2];
                                         else
                                          table=arrStr[1];
                                    }
                                    return table;
                        }
                        
                        public static void GenerationBaseClassCsharp(List<Models.SQL> table,string nameProject)
                        {
                           var service="";
                           var mapping="";
                           var dbset="";
                           table.ForEach(p=>{
                               service+=$"\nservices.AddTransient<I{p.TABLE_NAME}Repository, {p.TABLE_NAME}Repository>();\n";
                               mapping+=$"\nbuilder.ApplyConfiguration(new {p.TABLE_NAME}Map());\n";
                               var dd="{get;set;}";
                               dbset+=$"\npublic DbSet<{p.TABLE_NAME}> {p.TABLE_NAME.ToUpper()} {dd}\n";
                           });
                           var tmpRepositoryBase = File.ReadAllText($"Template/.Net Core/Rest/tmpRepositoryBase.txt");
                           var tmpIRepositoryBase = File.ReadAllText($"Template/.Net Core/Rest/tmpIRepositoryBase.txt");
                           var tmpService = File.ReadAllText($"Template/.Net Core/Rest/tmpService.txt");
                           var tmpStatup = File.ReadAllText($"Template/.Net Core/Rest/tmpStatup.txt");
                           var tmpAppsettings = File.ReadAllText($"Template/.Net Core/Rest/tmpappsettings.txt");
                           var tmpAppsettings_Development = File.ReadAllText($"Template/.Net Core/Rest/tmpappsettings.Development.txt");
                           var tmpCSPROJ = File.ReadAllText($"Template/.Net Core/Rest/tmpcsproj.txt");
                           var tmpHelp = File.ReadAllText($"Template/.Net Core/Rest/tmpHelp.txt");
                           var tmpBase = File.ReadAllText($"Template/.Net Core/Rest/tmpBase.txt");
                           var tmpResultView = File.ReadAllText($"Template/.Net Core/Rest/tmpResultView.txt");
                           var tmpDbContext = File.ReadAllText($"Template/.Net Core/Rest/tmpDbContext.txt");
                           var tmpITokenService = File.ReadAllText($"Template/.Net Core/Rest/tmpITokenService.txt");
                           var tmpPrograma = File.ReadAllText($"Template/.Net Core/Rest/tmpPrograma.txt");
                           tmpPrograma = tmpPrograma.Replaces(new Dictionary<string, string>() { { "nameProjecto", nameProject } });
                           tmpHelp = tmpHelp.Replaces(new Dictionary<string, string>() { { "nameProjecto", nameProject } });
                           tmpIRepositoryBase = tmpIRepositoryBase.Replaces(new Dictionary<string, string>() {  { "nameProjecto", nameProject } });
                           tmpRepositoryBase = tmpRepositoryBase.Replaces(new Dictionary<string, string>() {  { "nameProjecto", nameProject } });
                           tmpService = tmpService.Replaces(new Dictionary<string, string>() {   { "nameProjecto", nameProject } });
                           tmpStatup = tmpStatup.Replaces(new Dictionary<string, string>() {{ " /*@<service>@*/", service },  { "nameProjecto", nameProject } });
                           tmpBase = tmpBase.Replaces(new Dictionary<string, string>() {  { "nameProjecto", nameProject } });
                           tmpDbContext = tmpDbContext.Replaces(new Dictionary<string, string>() {  { "/*<dbSetT>*/", dbset },{"/*<mapping>*/",mapping}, { "nameProjecto", nameProject } });
                           tmpResultView = tmpResultView.Replaces(new Dictionary<string, string>() {  { "nameProjecto", nameProject } });
                           tmpITokenService = tmpITokenService.Replaces(new Dictionary<string, string>() {  { "nameProjecto", nameProject } });
                           QuerySQL.CreateFile($@"{nameProject}\Models/Base.cs", tmpBase);
                           QuerySQL.CreateFile($@"{nameProject}/Startup.cs", tmpStatup);
                           QuerySQL.CreateFile($@"{nameProject}\Service/TokenService.cs", tmpService);
                           QuerySQL.CreateFile($@"{nameProject}\Repositorie/RepositoryBase.cs", tmpRepositoryBase);
                           QuerySQL.CreateFile($@"{nameProject}\Interface/IRepositoryBase.cs", tmpIRepositoryBase);
                           QuerySQL.CreateFile($@"{nameProject}\Helper/Help.cs", tmpHelp);
                           QuerySQL.CreateFile($@"{nameProject}/{nameProject}.csproj", tmpCSPROJ);
                           QuerySQL.CreateFile($@"{nameProject}/appsettings.json", tmpAppsettings);
                           QuerySQL.CreateFile($@"{nameProject}/appsettings.Development.json", tmpAppsettings_Development);
                           QuerySQL.CreateFile($@"{nameProject}\DbConfig/{nameProject}Context.cs", tmpDbContext);
                           QuerySQL.CreateFile($@"{nameProject}\Models/ResultView.cs", tmpResultView);
                           QuerySQL.CreateFile($@"{nameProject}\Interface/ITokenService.cs", tmpITokenService);
                           QuerySQL.CreateFile($@"{nameProject}/Program.cs", tmpPrograma);
                        }
                        public static void CreateDir(string path)
                        {
                               var dirPrincipal=path.Split("/");     
                               if(Directory.Exists(dirPrincipal[0]))
                               {
                                  Directory.CreateDirectory(path);         
                               }
                               else
                               {
                                     Directory.CreateDirectory(dirPrincipal[0]); 
                                     Directory.CreateDirectory(path);       
                               }
                        }
            }
}