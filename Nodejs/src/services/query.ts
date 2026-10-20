
class QueryCustome {

  query(table: string) {
    return `
    select tab.name as [table],
    col.name as column_name,
  type_.name as type_name,
    pk_tab.name as primary_table,
    pk_col.name as pk_column_name,
    fk.name as fk_constraint_name,
  case when col.name = pk_column_name.name then pk_column_name.name else null end as pk_constraint_name
from sys.tables tab
    inner join sys.columns col 
        on col.object_id = tab.object_id
  inner join sys.types type_
    on type_.system_type_id = col.system_type_id
    left outer join sys.foreign_key_columns fk_cols
        on fk_cols.parent_object_id = tab.object_id
        and fk_cols.parent_column_id = col.column_id
    left outer join sys.foreign_keys fk
        on fk.object_id = fk_cols.constraint_object_id
    left outer join sys.tables pk_tab
        on pk_tab.object_id = fk_cols.referenced_object_id
    left outer join sys.columns pk_col
        on pk_col.column_id = fk_cols.referenced_column_id
        and pk_col.object_id = fk_cols.referenced_object_id
    inner join sys.indexes pk
        on tab.object_id = pk.object_id 
        and pk.is_primary_key = 1
    inner join sys.index_columns ic
        on ic.object_id = pk.object_id
        and ic.index_id = pk.index_id
    inner join sys.columns pk_column_name
        on pk.object_id = pk_column_name.object_id
        and pk_column_name.column_id = ic.column_id
where tab.name = "${table}" AND type_.name <> 'sysname'
order by schema_name(tab.schema_id) + '.' + tab.name,
    col.column_id`
  }
}

export { QueryCustome }