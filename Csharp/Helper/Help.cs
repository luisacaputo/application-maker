using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;

namespace Csharp.Helper
{
    public static class  Help
    {
        public static string RemoveLastChar(this string str)
        {
             string newstr="";
             for (var y = 0; y < str.Length - 2; y++)
             {
                newstr += str[y];
             }
             return newstr;
        } 
        public static string RemoveLastChar_(this string str)
        {
             string newstr="";
             for (var y = 0; y < str.Length - 1; y++)
             {
                newstr += str[y];
             }
             return newstr;
        } 
        public static string Replaces(this string str,Dictionary<string,string> search )
        {
             var keys=search.Keys.ToList();
             keys.ForEach(o=>{
                  var value=search.FirstOrDefault(x=>x.Key==o).Value.ToString();
                  str=str.Replace(o,value); 
             });
             return str;
        } 
        public static void ExecuteCMD()
        {
             ProcessStartInfo pro=new ProcessStartInfo();
             pro.FileName="cmd.exe";
             pro.Arguments="dotnet new console -o tetttet";
             Process proStart=new Process();
             proStart.StartInfo=pro;
             proStart.Start();
        }
    }
}