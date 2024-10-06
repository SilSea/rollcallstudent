create database rollcallstudent_db;

\c rollcallstudent_db;

create table section (id serial primary key,section varchar(2) null);

create table prefix (id serial primary key,prefix varchar(6) null);

create table curriculum (id serial primary key,curr_name_th varchar(70) null,
curr_name_en varchar(70) null,short_name_th varchar(30) null,
short_name_en varchar(30) null);

create table student (id serial primary key,student_number varchar(13) not null,prefix_id int not null,
first_name varchar(50) null,last_name varchar(50) null,date_of_birth date null,
curriculum_id int not null,previous_school varchar(70) null,address text null,
telephone varchar(10) null,email varchar(40) null,line_id varchar(30) null,
status varchar(1) default 'N' not null,foreign key(prefix_id) references prefix(id),
foreign key(curriculum_id) references curriculum(id));

create table student_list (id serial primary key,section_id int not null,
student_id int not null,active_date date not null,status varchar(1) default 'N' not null,
foreign key(section_id) references section(id),foreign key(student_id) references student(id));

create table teacher (id serial primary key,username varchar(50) not null,password varchar(50) not null,first_name varchar(50) null,last_name varchar(50) null,status varchar(1) default 'N' not null);