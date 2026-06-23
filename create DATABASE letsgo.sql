create DATABASE letsgo
set serveroutput on;
declare
  v_sql varchar2(4000);
begin
    v_sql := 'create table users (
        id number primary key,
        username varchar2(50) not null,
        password varchar2(50) not null,
        email varchar2(100) not null,
        created_at date default sysdate
    )';
    execute immediate v_sql;
    exeption
        when others then
            dbms_output.put_line('Error creating table: ' || sqlerrm);