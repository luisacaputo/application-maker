namespace Csharp.Models
{
    public class SQL
    {
        public string name { get; set; }
        public string TABLE_OWNER{get;set;}
        public string TABLE_NAME { get; set; }
    }
    public class Fields
    {
        public string TABLE_NAME{get;set;}
        public string DATA_TYPE{get;set;}
        public string COLUMN_NAME { get; set; }
        public string TYPE_NAME { get; set; }
        public string COLUMN_DEF { get; set; }
    }
    public class FieldPrimaryKey
    {
        public string table_name { get; set; }
        public string column_name { get; set; }
    }
    public class FieldForeignKey
    {
        public string PrimaryTableName { get; set; }
        public string ReferenceTableName { get; set; }
        public string ReferenceColumnName { get; set; }
        public string PrimaryColumnName { get; set; }
    }
    public class infoPath
 {
  public string dataCriacao { get; set; }
  public string Tamanho { get; set; }
  public string Categoria { get; set; }
  public string NameFile { get; set; }
 }
}