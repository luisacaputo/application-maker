using System;
using System.Collections.Generic;
using System.Linq;
using Csharp.Helper;
using Csharp.Models;

namespace Csharp
{
    class Program
    {
        static void Main(string[] args)
        {
            int i=0;
           //GenerationConfigure.GenerationCsharp("authors","nameProjecto");
          //var tabless=new List<SQL>{new SQL{TABLE_NAME="authors"}};
          // GenerationConfigure.GenerationBaseClassCsharp(tabless,"nameProjecto");   
           // Help.ExecuteCMD();
            // var tabless=QuerySQL.allTable();
            //   tabless.ForEach(o=>{
            //        QuerySQL.Generation(o.TABLE_NAME);
            //   }); 
            //QuerySQL.Generation("Payment");  
            var tableList=new List<string>();
            var config=new List<string>();
            Console.WriteLine("Seja bem vindo !");
            Console.WriteLine("Informa o provedor:");
            config.Add(Console.ReadLine());
            Console.WriteLine("Informa o servidor:");
            config.Add(Console.ReadLine());
            Console.WriteLine("Informa o user:");
            config.Add(Console.ReadLine());
            Console.WriteLine("Informa a senha:");
            config.Add(Console.ReadLine());
            Console.WriteLine("Informa o nome do Projecto:");
            var nameProjecto=Console.ReadLine();
            Console.Clear();
            var result= QuerySQL.allDataBase(config);
            Console.WriteLine("Seleciona a Base de dado:"); 
            foreach(var lin in result)
            {
              Console.WriteLine($"{i} - {lin.name}");
              i++;
            }
            var database=Console.ReadLine();
            Console.WriteLine("Gerar para todas as tabela?(sim/nao):");
            var opGeneration=Console.ReadLine(); 
            if(opGeneration.ToLower()=="sim")
            {
              var tables=QuerySQL.allTable(database).Where(e=>e.TABLE_OWNER=="dbo").ToList();
             
              tables.ForEach(o=>{
                 var ttable=GenerationConfigure.newTable(o.TABLE_NAME);
                 Console.WriteLine(o.TABLE_NAME);
              
                 var files= FileManager.GetAllFtps("");
                 var fileDir= files.Where(e=>e.NameFile==nameProjecto);
                 if(fileDir.Count()==0)
                  GenerationConfigure.GenerationCsharp(o.TABLE_NAME,nameProjecto);
                 else
                 {
                  
                    var fileExist= FileManager.FileExist(nameProjecto+"/Models");
                   
                    Console.WriteLine(fileExist.Count());
                    Console.WriteLine(ttable+".cs");
                    var _fileExist=fileExist.Where(n=>n.NameFile==$"{ttable}.cs");
                    Console.WriteLine(fileExist.FirstOrDefault().NameFile);
                    Console.WriteLine(_fileExist.Count());
                    if(_fileExist.Count()==0)
                     GenerationConfigure.GenerationCsharp(o.TABLE_NAME,nameProjecto);
                 }
                
             });
            GenerationConfigure.GenerationBaseClassCsharp(tables,nameProjecto);      
            }
            else
            {
                 Console.Clear();
                 Console.WriteLine("Seleciona a Tabela:");
                 i=0; 
                 var tables=QuerySQL.allTable(database).Where(e=>e.TABLE_OWNER=="dbo").ToList();
                 tables.ForEach(o=>{
                   Console.WriteLine($"{i} - {o.TABLE_NAME}");
                      i++;
                  }); 
                var tableGeneration=Console.ReadLine();
                var geneTable=tableGeneration.Split(",");
                for (int ii=0;ii<geneTable.Length;ii++)
                {
                   GenerationConfigure.GenerationCsharp(geneTable[ii],"");      
                }   
                 GenerationConfigure.GenerationBaseClassCsharp(null,nameProjecto);  
            }
          
        }
    }
}
