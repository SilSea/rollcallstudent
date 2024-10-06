-- Section
insert into section(id,section) VALUES (1,'1'),(2,'2');

-- PrefIx
insert into prefix(id,prefix) VALUES (1,'นาย'),(2,'นาง'),(3,'นางสาว');

-- Curriculum
insert into curriculum(id,curr_name_th,curr_name_en,short_name_th,short_name_en) VALUES 
(1,'วิทยาการคอมพิวเตอร์	','Computer Science','วท.บ(วิทยาการคอมพิวเตอร์) ','CS'),
(2,'เทคโนโลยีสารสนเทศ','Information Technology','วท.บ(เทคโนโลยีสารสนเทศ)','IT');

-- Student
insert into student(id,prefix_id,first_name,last_name,date_of_birth,curriculum_id,
previous_school,address,telephone,email,line_id) VALUES
(1,1,'ทดสอบ','นามสกุล','2001-09-05',2,'โรงเรียนก่อนหน้า','ที่อยู่','0999999999','email@mail.com',
'test@1'),
(2,1,'ทดสอบ2','นามสกุล2','2001-09-04',2,'โรงเรียนก่อนหน้า2','ที่อยู่2','0999999990','email2@mail.com',
'test@2'),
(3,2,'ทดสอบ3','นามสกุล3','2001-09-01',1,'โรงเรียนก่อนหน้า3','ที่อยู่3','0999999991','email3@mail.com',
'test@3'),
(4,3,'ทดสอบ4','นามสกุล4','2001-09-02',1,'โรงเรียนก่อนหน้า4','ที่อยู่4','0999999992','email4@mail.com',
'test@4');

-- StudentList
insert into student_list(id,section_id,student_id,active_date,status) VALUES
(1,1,1,'2024-09-08','N'),
(2,1,3,'2024-09-08','N'),
(3,2,2,'2024-09-09','M'),
(4,2,4,'2024-09-09','N');
