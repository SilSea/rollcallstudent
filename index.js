import express from 'express';
import session from 'express-session';
import conDB from './db.js';
import bodyParser from 'body-parser';
import moment from 'moment-timezone';
import req from 'express/lib/request.js';
import { render } from 'ejs';

const app = express();
const port = process.env.port || 3000;

// ตั้งค่าให้ Express ใช้ EJS เป็น Template Engine
app.set('view engine', 'ejs');

// Middleware สำหรับ parsing body
app.use(bodyParser.urlencoded({ extended: true }));

app.use(bodyParser.json());

// ตั้งค่าโฟลเดอร์ assets สำหรับไฟล์ static เช่น CSS, รูปภาพ, และ JS
app.use(express.static('assets'));

app.use(session({ //สร้าง session
    secret: 'secret_key', // ใช้สำหรับเข้ารหัส session
    resave: false, // ไม่ต้องบันทึก session ใหม่ทุกครั้ง
    saveUninitialized: true, // ต้องบันทึก session ใหม่ทุกครั้ง
    cookie: { maxAge: 1800000 } // อายุของ session ใน ms (30 นาที)
}));

// ฟังก์ชันสำหรับสร้างปฏิทินของเดือนที่กำหนด
const generateCalendar = (year, month) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate(); // หาจำนวนวันในเดือนนั้น
    const firstDay = new Date(year, month, 1).getDay(); // หาวันแรกของเดือนว่าเป็นวันอะไร (0 = อาทิตย์)
    
    const weeks = [];
    let currentWeek = new Array(7).fill(null); // สร้าง array ที่มี 7 ช่องสำหรับแต่ละสัปดาห์

    let day = 1;

    // วนลูปเพื่อสร้างสัปดาห์
    for (let i = 0; i < 6; i++) { // โดยปกติปฏิทินจะมีไม่เกิน 6 สัปดาห์
        for (let j = 0; j < 7; j++) {
            if (i === 0 && j < firstDay) {
                // ถ้าเป็นวันก่อนวันที่ 1 ของเดือน ให้เว้นว่าง
                currentWeek[j] = null;
            } else if (day <= daysInMonth) {
                currentWeek[j] = day++;
            } else {
                currentWeek[j] = null; // หลังจากวันที่หมดให้เว้นว่าง
            }
        }
        weeks.push(currentWeek); // เก็บสัปดาห์ลงใน weeks array
        currentWeek = new Array(7).fill(null); // รีเซ็ต currentWeek สำหรับสัปดาห์ถัดไป

        // หยุดการสร้างสัปดาห์ถ้าทุกวันในเดือนนี้ถูกเติมแล้ว
        if (day > daysInMonth) {
            break;
        }
    }

    return weeks;
};

// หน้าแรก
app.get('/', async (req, res) =>{
    res.render('index.ejs');
});

// หน้าแสดงข้อมูลเช็คชื่อ
app.get('/info/:id', async (req, res) => {
    const student = String(req.params.id); //รหัสนักศึกษา
    const year = new Date().getFullYear(); // ปีปัจจุบัน
    const month = new Date().getMonth();   // เดือนปัจจุบัน (0 = ม.ค.)
    const daydate = []; //วันที่มีการเข้า
    const daystatus = [];

    // สร้างปฏิทินสำหรับเดือนนั้น ๆ
    const calendar = generateCalendar(year, month);

    try {
        // ดึงข้อมูลนักศึกษา
        const result_student = await conDB.query(
            `select student.id as student_id, * from student 
            join prefix on student.prefix_id = prefix.id 
            join curriculum on student.curriculum_id = curriculum.id 
            where student_number = $1 `,[student]
        );

        // ถ้าไม่พบให้เปลี่ยนหน้าไปแสดง error
        if (result_student.rows.length === 0) {
            return res.status(404).send(
                `<script>
                    window.location.href='/notice/stdNotFound';
                </script>`);
        }

        // ตรวจสอบสถานะนักศึกษา
        const studentStatus = result_student.rows[0].status;
        if (studentStatus === 'C') {
            return res.status(403).send(
                `<script>
                    window.location.href='/notice/stdIsCancel'; // หรือไปที่หน้าอื่นที่ต้องการ
                </script>`
            );
        }

        // ดึงข้อมูลวันที่เข้าเรียน || หมายถึงรวมข้อความ
        const result_daychecked = await conDB.query(
            `SELECT * FROM student_list 
             WHERE student_id = $1 
             AND to_char(active_date, 'YYYY-MM-DD') LIKE $2 || '-' || $3 || '%'
             ORDER BY active_date ASC`, 
            [result_student.rows[0].student_id, year.toString(), parseInt(month + 1)]
        );
        
        // ฟังชั่นแยกวัน
        result_daychecked.rows.forEach(rows => {
            const dateNewFormat = moment(rows.active_date).tz('Asia/Bangkok').format('YYYY-MM-DD'); //แปลง format เป็น 2024-09-10
            let checkday = parseInt(dateNewFormat.substring(8,10)); //แยกวัน
            daydate.push(checkday); //เพิ่มวันลงไปใน array
            daystatus.push(rows.status);
        });

        res.render('info.ejs', { student_info: result_student.rows, calendar, year, month, daydate, daystatus });
    }catch (err){
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// ดูเช็คเข้าเรียนย้อนหลัง
app.get('/info/:id/:month/:year', async (req, res) => {
    const student = String(req.params.id); //รหัสนักศึกษา
    const year = req.params.year; //ปีที่ต้องการ
    const cfmonth = req.params.month; //เดือนที่ต้องการ
    const month = parseInt(cfmonth)-1; //แปลงใช้ในปฎิทิน 0 = มกราคม
    const daydate = []; //วันที่มีการเข้า
    const daystatus = [];

    // สร้างปฏิทินสำหรับเดือนนั้น ๆ
    const calendar = generateCalendar(year, month);

    try {
        // ดึงข้อมูลนักศึกษา
        const result_student = await conDB.query(
            `SELECT student.id as student_id, * FROM student 
            JOIN prefix ON student.prefix_id = prefix.id 
            JOIN curriculum ON student.curriculum_id = curriculum.id 
            WHERE student_number = $1 `,[student]
        );

        // ถ้าไม่พบให้เปลี่ยนหน้าไปแสดง error
        if (result_student.rows.length === 0) {
            return res.status(404).send(
                `<script>
                    window.location.href='/notice/stdNotFound';
                </script>`
            );
        }

        // ตรวจสอบสถานะนักศึกษา
        const studentStatus = result_student.rows[0].status;
        if (studentStatus === 'C') {
            return res.status(403).send(
                `<script>
                    window.location.href='/notice/stdIsCancel'; // หรือไปที่หน้าอื่นที่ต้องการ
                </script>`
            );
        }

        // ดึงข้อมูลวันที่เข้าเรียน || หมายถึงรวมข้อความ
        const result_daychecked = await conDB.query(
            `SELECT * FROM student_list 
             WHERE student_id = $1 
             AND to_char(active_date, 'YYYY-MM-DD') LIKE $2 || '-' || $3 || '%'
             ORDER BY active_date ASC`, 
            [result_student.rows[0].student_id, year.toString(), cfmonth]
        );
        
        // ฟังชั่นแยกวัน
        result_daychecked.rows.forEach(rows => {
            const dateNewFormat = moment(rows.active_date).tz('Asia/Bangkok').format('YYYY-MM-DD'); //แปลง format เป็น 2024-09-10
            let checkday = parseInt(dateNewFormat.substring(8,10)); //แยกวัน
            daydate.push(checkday); //เพิ่มวันลงไปใน array
            daystatus.push(rows.status);
        });
        
        res.render('info.ejs', { student_info: result_student.rows, calendar, year, month, daydate, daystatus });
    }catch (err){
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// หน้าล็อคอิน
app.get('/login', (req, res) => {
    // เช็คล็อกอิน
    if(req.session.isLogin){
        return res.redirect('/dashboard');
    }
    res.render('login.ejs');
});

// แจ้งเตือนหน้าล็อคอิน
app.get('/login/:notice', (req, res) => {
    // เช็คล็อกอิน
    if(req.session.isLogin){
        return res.redirect('/dashboard');
    }
    res.render('login.ejs');
});

// เข้าสู่ระบบ
app.post('/login', async (req, res) =>{
    const username = req.body.user;
    const password = req.body.pass;

    try {
        const result_teacher = await conDB.query(
            `SELECT * FROM teacher WHERE username = $1 AND password = $2`,[username,password]
        );

        if(result_teacher.rows.length == 1){
            req.session.isLogin = true;
            req.session.userid = result_teacher.rows[0].id;
            req.session.name = result_teacher.rows[0].first_name;

            res.redirect('/dashboard/lgSuccess');
        }else{
            res.redirect('/login/lgNotFound');
        }
    }catch (err){
        console.error(err.message);
        res.status(500).send('Server error');
    }
    
});

// ออกจากระบบ
app.get('/logout', (req, res) => {
    //ลบ session
    req.session.destroy(err => {
        if (err) {
            return res.send('Error logging out');
        }
        res.redirect('/login/loSuccess');
    });
});

// หน้า dashboard
app.get('/dashboard', (req, res) => {
    // เช็คว่าได้ล็อคอินยัง
    if(!req.session.isLogin){
        return res.redirect('/login');
    }
    res.render('management.ejs', { checklogin: req.session });
});

// ส่งแจ้งเตือนล็อกอิน
app.get('/dashboard/:notice', (req, res) => {

    // เช็คว่าได้ล็อคอินยัง
    if(!req.session.isLogin){
        return res.redirect('/login');
    }

    res.render('management.ejs', { checklogin: req.session });
});

// หน้าเช็คการเข้าเรียนทั้งหมด
app.get('/allcheckdate', async (req, res) => {

    // เช็คว่าได้ล็อคอินยัง
    if(!req.session.isLogin){
        return res.redirect('/login');
    }

    try {
        // ดึงกลุ่มวันที่เช็ค
        const result_checkday = await conDB.query(
            `SELECT TO_CHAR(student_list.active_date, 'DD-MM-YYYY') AS checkedday, section.section
            FROM student_list 
            JOIN section ON section.id = student_list.section_id
            GROUP BY checkedday, section.section
            ORDER BY checkedday DESC`
        );

        res.render('allcheckdate.ejs', { checklogin: req.session, checkdayinfo: result_checkday.rows });

    }catch (err){
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// หน้าเช็คชื่อ
app.get('/addcheckdate', async (req, res) => {

    // เช็คว่าได้ล็อคอินยัง
    if(!req.session.isLogin){
        return res.redirect('/login');
    }

    try {
        // ดึงข้อมูลนักศึกษา
        const result_student = await conDB.query(
            `SELECT student.id as student_id, * FROM student 
            JOIN prefix ON student.prefix_id = prefix.id 
            JOIN curriculum ON student.curriculum_id = curriculum.id
            ORDER BY student.student_number ASC
            `
        );

        const result_section = await conDB.query(
            `SELECT * FROM section ORDER BY section ASC`
        );

        res.render('addcheckdate.ejs', { checklogin: req.session, studentinfo: result_student.rows, sectioninfo: result_section.rows });

    }catch (err){
        console.error(err.message);
        res.status(500).send('Server error');
    }
    
});

// เพิ่มข้อมูลลง addcheckdate
app.post('/addcheckdate', async  (req, res) => {

    // ดึงข้อมูลจาก addcheckdate
    const insertData = req.body;

    // เช็คว่าได้ล็อคอินยัง
    if(!req.session.isLogin){
        return res.redirect('/login');
    }
    
    try {

        // วนลูปเพิ่มข้อมูล
        for (const data of insertData) {
            
            // insert ข้อมูล
            const result_addcheckdate = await conDB.query(
                `
                INSERT INTO student_list(section_id, student_id, active_date, status) VALUES
                ($1,$2,$3,$4)
                `,[data.section, data.studentid, data.date, data.status]
            );

        }

    }catch (err){
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

app.get('/editcheckdate/:date', async (req, res) => {

    // ดึงข้อมูลวันที่ต้องการแก้
    const datechecked = req.params.date;
    const day = datechecked.substring(0,2);
    const month = datechecked.substring(3,5);
    const year = datechecked.substring(6,10);
    const dateCondition = year + '-' + month + '-' + day;

    // เช็คว่าได้ล็อคอินยัง
    if(!req.session.isLogin){
        return res.redirect('/login');
    }

    try {
        // ดึงข้อมูลนักศึกษา
        const result_student = await conDB.query(
            `SELECT student.id as student_id, * FROM student 
            JOIN prefix ON student.prefix_id = prefix.id 
            JOIN curriculum ON student.curriculum_id = curriculum.id
            ORDER BY student.student_number ASC
            `
        );

        const result_section = await conDB.query(
            `SELECT * FROM section ORDER BY section ASC`
        );

        const result_studentcheck = await conDB.query(
            `SELECT * FROM student_list
            WHERE active_date = $1`,
            [dateCondition]
        );

        res.render('editcheckdate.ejs', { checklogin: req.session, studentinfo: result_student.rows, sectioninfo: result_section.rows, datedata: result_studentcheck.rows, dateCondition });

    }catch (err){
        console.error(err.message);
        res.status(500).send('Server error');
    }
    
});

// เพิ่มหรืออัปเดตข้อมูลลง editcheckdate
app.post('/editcheckdate', async (req, res) => {

    // ดึงข้อมูลจาก editcheckdate
    const insertData = req.body;

    // เช็คว่าได้ล็อคอินยัง
    if (!req.session.isLogin) {
        return res.redirect('/login');
    }

    try {
        // วนลูปเพิ่มข้อมูล
        for (const data of insertData) {
            // ตรวจสอบก่อนว่ามีข้อมูลที่ซ้ำกันในตาราง student_list แล้วหรือยัง
            const result_check = await conDB.query(
                `
                SELECT * FROM student_list 
                WHERE student_id = $1 AND active_date = $2
                `,
                [data.studentid, data.date]
            );

            if (result_check.rows.length > 0) {
                // ถ้ามีข้อมูลอยู่แล้ว ให้ทำการ UPDATE
                const result_update = await conDB.query(
                    `
                    UPDATE student_list 
                    SET section_id = $1, status = $2 
                    WHERE student_id = $3 AND active_date = $4
                    `,
                    [data.section, data.status, data.studentid, data.date]
                );
            } else {
                // ถ้าไม่มีข้อมูล ให้ทำการ INSERT
                const result_insert = await conDB.query(
                    `
                    INSERT INTO student_list (section_id, student_id, active_date, status) 
                    VALUES ($1, $2, $3, $4)
                    `,
                    [data.section, data.studentid, data.date, data.status]
                );
            }
        }

        res.redirect('/allcheckdate'); // กลับไปที่หน้า allcheckdate เมื่อทำงานเสร็จ

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// ลบข้อมูล checkdate ใน student_list
app.get('/delcheckdate/:date', async (req, res) => {

    // ดึงข้อมูลวันที่จาก URL
    const datechecked = req.params.date;

    // เช็คว่าได้ล็อคอินหรือยัง
    if (!req.session.isLogin) {
        return res.redirect('/login');
    }

    try {
        // แปลงรูปแบบวันที่จาก DD-MM-YYYY เป็น YYYY-MM-DD
        const day = datechecked.substring(0, 2);
        const month = datechecked.substring(3, 5);
        const year = datechecked.substring(6, 10);
        const dateCondition = `${year}-${month}-${day}`;  // รูปแบบ YYYY-MM-DD

        // ลบข้อมูลจากตาราง student_list ตามวันที่
        const result_delete = await conDB.query(
            `
            DELETE FROM student_list 
            WHERE active_date = $1
            `,
            [dateCondition]
        );

        // กลับไปที่หน้า allcheckdate หลังจากลบข้อมูลสำเร็จ
        res.redirect('/allcheckdate');

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});


// หน้าข้อมูลนักศึกษาทั้งหมด
app.get('/allstudent', async (req, res) => {

    // เช็คว่าได้ล็อคอินยัง
    if(!req.session.isLogin){
        return res.redirect('/login');
    }

    try {
        // ดึงข้อมูลนักศึกษา
        const result_student = await conDB.query(
            `SELECT student.id as student_id, TO_CHAR(student.date_of_birth, 'DD-MM-YYYY') as birthday ,* FROM student 
            JOIN prefix ON student.prefix_id = prefix.id 
            JOIN curriculum ON student.curriculum_id = curriculum.id
            ORDER BY student_number ASC`
        );

        res.render('allstudent.ejs', { checklogin: req.session, studentinfo: result_student.rows });

    }catch (err){
        console.error(err.message);
        res.status(500).send('Server error');
    }
    
});

// แจ้งเตือนหน้าข้อมูลนักศึกษา
app.get('/allstudent/:notice', async (req, res) => {

    // เช็คว่าได้ล็อคอินยัง
    if(!req.session.isLogin){
        return res.redirect('/login');
    }

    try {
        // ดึงข้อมูลนักศึกษา
        const result_student = await conDB.query(
            `SELECT student.id as student_id, TO_CHAR(student.date_of_birth, 'DD-MM-YYYY') as birthday ,* FROM student 
            JOIN prefix ON student.prefix_id = prefix.id 
            JOIN curriculum ON student.curriculum_id = curriculum.id
            ORDER BY student_number ASC`
        );

        res.render('allstudent.ejs', { checklogin: req.session, studentinfo: result_student.rows });

    }catch (err){
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// หน้า addstudent
app.get('/addstudent', async (req, res) => {

    // เช็คว่าได้ล็อคอินหรือยัง
    if(!req.session.isLogin){
        return res.redirect('/login');
    }

    try {
        // ดึงข้อมูลจากตาราง prefix
        const result_prefix = await conDB.query(`SELECT * FROM prefix ORDER BY id ASC`);

        // ดึงข้อมูลจากตาราง curriculum
        const result_curriculum = await conDB.query(`SELECT * FROM curriculum ORDER BY id ASC`);

        // ส่งข้อมูลไป render ที่หน้า addstudent.ejs
        res.render('addstudent.ejs', {
            checklogin: req.session, 
            prefixinfo: result_prefix.rows, 
            curriculuminfo: result_curriculum.rows
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// หน้า editstudent
app.get('/editstudent/:id', async (req, res) => {

    // เช็คว่าได้ล็อคอินหรือยัง
    if (!req.session.isLogin) {
        return res.redirect('/login');
    }

    const studentId = req.params.id; // ดึง student ID จาก URL

    try {
        // ดึงข้อมูลจากตาราง prefix
        const result_prefix = await conDB.query(`SELECT * FROM prefix ORDER BY id ASC`);

        // ดึงข้อมูลจากตาราง curriculum
        const result_curriculum = await conDB.query(`SELECT * FROM curriculum ORDER BY id ASC`);

        // ดึงข้อมูลนักเรียนจากตาราง student โดยใช้ student ID
        const result_student = await conDB.query(`SELECT * FROM student WHERE id = $1`, [studentId]);

        // เช็คว่ามีนักเรียนที่ต้องการแก้ไขหรือไม่
        if (result_student.rows.length === 0) {
            return res.status(404).send('Student not found'); // หากไม่พบให้แสดงข้อผิดพลาด
        }

        // ส่งข้อมูลไป render ที่หน้า editstudent.ejs
        res.render('editstudent.ejs', {
            checklogin: req.session,
            prefixinfo: result_prefix.rows,
            curriculuminfo: result_curriculum.rows,
            studentinfo: result_student.rows[0] // ส่งข้อมูลนักเรียนตัวแรก
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// ส่งข้อมูลหน้า addstudent ไปบันทึกข้อมูล
app.post('/addstudent', async (req, res) => {
    const studentData = req.body;

    // เช็คว่าได้ล็อคอินหรือยัง
    if (!req.session.isLogin) {
        return res.redirect('/login');
    }

    try {
        // ตรวจสอบว่ามีนักเรียนที่มีรหัสซ้ำหรือไม่
        const existingStudent = await conDB.query(
            `SELECT * FROM student WHERE student_number = $1`,
            [studentData.studentNumber]
        );

        if (existingStudent.rows.length > 0) {
            // หากพบข้อมูลนักเรียนซ้ำ ส่งข้อความกลับไป
            return res.status(400).json({ message: 'รหัสนักเรียนนี้มีอยู่ในระบบแล้ว' });
        }

        // แทรกข้อมูลนักเรียนลงในฐานข้อมูล
        const result = await conDB.query(
            `INSERT INTO student (student_number, prefix_id, first_name, last_name, date_of_birth, previous_school, address, telephone, email, line_id, curriculum_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [studentData.studentNumber, studentData.prefix, studentData.firstName, studentData.lastName,
            studentData.birthDate, studentData.previousSchool, studentData.address, studentData.phone,
            studentData.email, studentData.lineId, studentData.curriculum]
        );

        res.status(201).json({ message: 'บันทึกข้อมูลนักเรียนเรียบร้อย', studentId: result.insertId });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
});

// ทำการอัปข้อมูลนักศึกษา
app.post('/editstudent', async (req, res) => {
    const { id, studentNumber, prefix, firstName, lastName, birthDate, previousSchool, address, phone, email, lineId, curriculum, status } = req.body;

    try {
        // Update student information
        const result = await conDB.query(
            `UPDATE student 
            SET 
                student_number = $1,
                prefix_id = $2,
                first_name = $3,
                last_name = $4,
                date_of_birth = $5,
                previous_school = $6,
                address = $7,
                telephone = $8,
                email = $9,
                line_id = $10,
                curriculum_id = $11,
                status = $12
            WHERE id = $13`,
            [
                studentNumber,
                prefix,
                firstName,
                lastName,
                birthDate,
                previousSchool,
                address,
                phone,
                email,
                lineId,
                curriculum,
                status,
                id // Use the student ID for the update
            ]
        );

        if (result.rowCount > 0) {
            res.json({ message: 'อัปเดตข้อมูลนักเรียนเรียบร้อยแล้ว.' });
        } else {
            res.status(404).json({ message: 'ไม่พบข้อมูลนักเรียน.' });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์.' });
    }
});


// หน้าข้อมูลหลักสูตรทั้งหมด
app.get('/allcurriculum', async (req, res) => {

    // เช็คว่าได้ล็อคอินยัง
    if(!req.session.isLogin){
        return res.redirect('/login');
    }

    try {
        // ดึงข้อมูลหลักสูตร
        const result_curriculum = await conDB.query(
            `SELECT * FROM curriculum`
        );

        res.render('allcurriculum.ejs', { checklogin: req.session, curriculuminfo: result_curriculum.rows });

    }catch (err){
        console.error(err.message);
        res.status(500).send('Server error');
    }
    
});

// หน้าเพิ่มข้อมูล
app.get('/addcurriculum', (req, res) => {

    // เช็คว่าได้ล็อคอินยัง
    if(!req.session.isLogin){
        return res.redirect('/login');
    }

    res.render('addcurriculum.ejs', { checklogin: req.session});
});

// แจ้งเตือนหน้าหลักสูตรทั้งหมด
app.get('/allcurriculum/:notice', async (req, res) => {

    // เช็คว่าได้ล็อคอินยัง
    if(!req.session.isLogin){
        return res.redirect('/login');
    }

    try {
        // ดึงข้อมูลหลักสูตร
        const result_curriculum = await conDB.query(
            `SELECT * FROM curriculum`
        );

        res.render('allcurriculum.ejs', { checklogin: req.session, curriculuminfo: result_curriculum.rows });

    }catch (err){
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// เพิ่มข้อมูลลงฐานข้อมูล
app.post('/addcurriculum', async (req, res) => {

    // เช็คว่าได้ล็อคอินยัง
    if(!req.session.isLogin){
        return res.redirect('/login');
    }

    //ดึงข้อมูลจาก form 
    const { currNameTh, currNameEn, shortNameTh, shortNameEn } = req.body;

    try {
        // ตรวจสอบว่าหลักสูตรซ้ำหรือไม่ โดยใช้ชื่อหลักสูตรภาษาไทยและภาษาอังกฤษ
        const checkDuplicate = await conDB.query(
            `SELECT * FROM curriculum WHERE curr_name_th = $1 OR curr_name_en = $2`,
            [currNameTh, currNameEn]
        );

        if (checkDuplicate.rows.length > 0) {
            // ถ้ามีหลักสูตรซ้ำ
            return res.status(400).json({
                success: false,
                message: "หลักสูตรนี้มีอยู่ในระบบแล้ว"
            });
        }

        // ถ้าไม่ซ้ำ ให้เพิ่มหลักสูตรลงในฐานข้อมูล
        await conDB.query(
            `INSERT INTO curriculum (curr_name_th, curr_name_en, short_name_th, short_name_en)
             VALUES ($1, $2, $3, $4)`,
            [currNameTh, currNameEn, shortNameTh, shortNameEn]
        );

        // ส่งคำตอบกลับมาว่าบันทึกสำเร็จ
        return res.status(201).json({
            success: true,
            message: "บันทึกหลักสูตรเรียบร้อยแล้ว"
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({
            success: false,
            message: "เกิดข้อผิดพลาดในระบบ"
        });
    }
});

// หน้าแก้ไขหลักสูตร curriculum
app.get('/editcurriculum/:id', async (req, res) => {

    // ตรวจสอบว่าได้ล็อกอินหรือไม่
    if (!req.session.isLogin) {
        return res.redirect('/login');
    }

    const curriculumId = req.params.id;

    try {
        // ดึงข้อมูลหลักสูตรจากฐานข้อมูลตาม ID
        const result = await conDB.query(
            `SELECT * FROM curriculum WHERE id = $1`,
            [curriculumId]
        );

        // ถ้าไม่พบข้อมูล ให้แสดงหน้า error หรือแจ้งเตือน
        if (result.rows.length === 0) {
            return res.status(404).send('ไม่พบหลักสูตรนี้ในระบบ');
        }

        // ส่งข้อมูลหลักสูตรไปยังหน้า editcurriculum.ejs
        res.render('editcurriculum.ejs', {
            curriculum: result.rows[0], // ส่งข้อมูลหลักสูตรที่ดึงมา
            checklogin: req.session      // ส่งสถานะการล็อกอินไปด้วย
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('เกิดข้อผิดพลาดในระบบ');
    }
});

// แก้ไขข้อมูลลงตาราง Curriculum
app.post('/editcurriculum', async (req, res) => {

    // เช็คว่าได้ล็อคอินยัง
    if(!req.session.isLogin){
        return res.redirect('/login');
    }

    const { id, currNameTh, currNameEn, shortNameTh, shortNameEn } = req.body;

    // ตรวจสอบข้อมูลที่ส่งมาไม่ให้ว่าง
    if (!id || !currNameTh || !currNameEn || !shortNameTh || !shortNameEn) {
        return res.json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน.' });
    }

    try {
        // ตรวจสอบว่ามีหลักสูตรอื่นที่มีชื่อภาษาไทยหรืออังกฤษซ้ำกันหรือไม่ (ยกเว้นหลักสูตรที่กำลังแก้ไข)
        const checkDuplicate = await conDB.query(
            `SELECT * FROM curriculum 
             WHERE (curr_name_th = $1 OR curr_name_en = $2) 
             AND id != $3`, 
            [currNameTh, currNameEn, id]
        );

        // ถ้ามีหลักสูตรซ้ำ
        if (checkDuplicate.rows.length > 0) {
            return res.json({
                success: false,
                message: 'มีหลักสูตรที่มีชื่อภาษาไทยหรือภาษาอังกฤษนี้อยู่แล้ว.'
            });
        }

        // ตรวจสอบว่า curriculum ที่มี id นี้มีอยู่ในฐานข้อมูลหรือไม่
        const checkCurriculum = await conDB.query('SELECT * FROM curriculum WHERE id = $1', [id]);

        if (checkCurriculum.rows.length === 0) {
            return res.json({ success: false, message: 'ไม่พบข้อมูลหลักสูตร.' });
        }

        // อัปเดตข้อมูลในตาราง curriculum
        await conDB.query(
            `UPDATE curriculum
             SET curr_name_th = $1, curr_name_en = $2, short_name_th = $3, short_name_en = $4
             WHERE id = $5`,
            [currNameTh, currNameEn, shortNameTh, shortNameEn, id]
        );

        // ส่งผลลัพธ์กลับไปที่ client ว่าอัปเดตสำเร็จ
        return res.json({ success: true, message: 'อัปเดตข้อมูลเรียบร้อยแล้ว.' });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล.' });
    }
});

// หน้าข้อมูลห้องทั้งหมด
app.get('/allsection', async (req, res) => {

    // เช็คว่าได้ล็อคอินยัง
    if(!req.session.isLogin){
        return res.redirect('/login');
    }

    try {
        // ดึงข้อมูลห้อง
        const result_section = await conDB.query(
            `SELECT * FROM section`
        );

        res.render('allsection.ejs', { checklogin: req.session, sectioninfo: result_section.rows });

    }catch (err){
        console.error(err.message);
        res.status(500).send('Server error');
    }
    
});

// แจ้งเตือนหน้าข้อมูลห้องทั้งหมด
app.get('/allsection/:notice', async (req, res) => {

    // เช็คว่าได้ล็อคอินยัง
    if(!req.session.isLogin){
        return res.redirect('/login');
    }

    try {

        // ดึงข้อมูลห้อง
        const result_section = await conDB.query(
            `SELECT * FROM section`
        );

        res.render('allsection.ejs', { checklogin: req.session, sectioninfo: result_section.rows });

    }catch (err){
        console.error(err.message);
        res.status(500).send('Server error');
    }

});

// หน้าเพิ่ม section
app.get('/addsection', async (req, res) => {

    // เช็คว่าได้ล็อคอินยัง
    if(!req.session.isLogin){
        return res.redirect('/login');
    }

    res.render('addsection.ejs',{ checklogin: req.session} )
});

// เพิ่มข้อมูลลง section
app.post('/addsection', async (req, res) => {
    const { sectionName } = req.body;

    // ตรวจสอบข้อมูลที่ส่งมาไม่ให้ว่าง
    if (!sectionName) {
        return res.json({ success: false, message: 'กรุณากรอกชื่อ Section.' });
    }

    try {
        // ตรวจสอบว่าชื่อ section ซ้ำหรือไม่
        const checkSection = await conDB.query('SELECT * FROM section WHERE section = $1', [sectionName]);

        if (checkSection.rows.length > 0) {
            return res.json({ success: false, message: 'ชื่อ Section นี้มีอยู่แล้ว.' });
        }

        // ทำการ insert ข้อมูลเข้าไปในตาราง section
        await conDB.query('INSERT INTO section (section) VALUES ($1)', [sectionName]);

        // ส่งผลลัพธ์กลับไปที่ client ว่าบันทึกสำเร็จ
        return res.json({ success: true, message: 'บันทึกข้อมูล Section เรียบร้อยแล้ว.' });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล.' });
    }
});


// หน้าแก้ไข section
app.get('/editsection/:id', async (req, res) => {
    // เช็คว่าได้ล็อคอินยัง
    if (!req.session.isLogin) {
        return res.redirect('/login');
    }

    const sectionId = req.params.id; // ดึง ID จาก URL

    try {
        // ดึงข้อมูลจากตาราง section โดยใช้ ID
        const result = await conDB.query('SELECT * FROM section WHERE id = $1', [sectionId]);

        // เช็คว่าพบข้อมูลหรือไม่
        if (result.rows.length === 0) {
            return res.status(404).send('ไม่พบข้อมูล Section ที่ต้องการแก้ไข');
        }

        // ส่งข้อมูลไปยังหน้า editsection.ejs
        res.render('editsection.ejs', {
            checklogin: req.session,
            section: result.rows[0] // ส่งข้อมูล section ที่พบ
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูล');
    }
});

//แก้ข้อมูลในตาราง section 
app.post('/editsection', async (req, res) => {

    // เช็คว่าได้ล็อคอินยัง
    if (!req.session.isLogin) {
        return res.redirect('/login');
    }

    const { id, sectionName } = req.body;

    // ตรวจสอบว่าชื่อ Section ว่างไหม
    if (!id || !sectionName) {
        return res.json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน.' });
    }

    try {
        // เช็คว่าชื่อ Section ซ้ำไหม
        const existingSection = await conDB.query('SELECT * FROM section WHERE section = $1 AND id != $2', [sectionName, id]);
        if (existingSection.rows.length > 0) {
            return res.json({ success: false, message: 'ชื่อ Section นี้มีอยู่แล้วในฐานข้อมูล.' });
        }

        // อัปเดตข้อมูลในตาราง section
        await conDB.query('UPDATE section SET section = $1 WHERE id = $2', [sectionName, id]);
        return res.json({ success: true });

    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล.' });
    }
});

app.get('/editaccount', async (req, res) => {
    // เช็คว่าได้ล็อคอินยัง
    if (!req.session.isLogin) {
        return res.redirect('/login');
    }

    const userId = req.session.userid;

    try {
        // ดึงข้อมูลจากฐานข้อมูลโดยใช้ ID
        const result = await conDB.query('SELECT * FROM teacher WHERE id = $1', [userId]);

        // ตรวจสอบว่าพบข้อมูลหรือไม่
        if (result.rows.length === 0) {
            return res.status(404).send('ไม่พบข้อมูลผู้สอน');
        }

        const teacher = result.rows[0]; // ข้อมูลผู้สอน

        // ส่งข้อมูลไปยัง template
        res.render('editaccount.ejs', {
            checklogin: req.session,
            teacher: teacher // ส่งข้อมูลผู้สอนไปยังหน้า editaccount
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูล');
    }
});


// หน้าแก้ไขข้อมูล account
app.post('/editaccount', async (req, res) => {
    // เช็คว่าได้ล็อคอินยัง
    if (!req.session.isLogin) {
        return res.redirect('/login');
    }

    const { username, password, firstName, lastName } = req.body;

    // ตรวจสอบข้อมูลที่ส่งมา
    if (!username || !password || !firstName || !lastName) {
        return res.json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน.' });
    }

    try {
        // อัปเดตข้อมูลในตาราง teacher
        await conDB.query(
            `UPDATE teacher
             SET password = $1, first_name = $2, last_name = $3
             WHERE id = $4`,
            [password, firstName, lastName, req.session.userid]
        );

        return res.json({ success: true, message: 'อัปเดตข้อมูลเรียบร้อยแล้ว.' });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล.' });
    }
});


// หน้าแสดง error
app.get('/notice/:err', (req, res) => {
    res.render('notice.ejs');
});

app.listen(port,() => {
    console.log(`Server is running on port ${port}`);
});