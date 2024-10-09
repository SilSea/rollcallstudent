import express from 'express';
import session from 'express-session';
import conDB from './db.js';
import bodyParser from 'body-parser';
import moment from 'moment-timezone';

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
        });

        res.render('info.ejs', { student_info: result_student.rows, calendar, year, month, daydate });
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
        });
        
        res.render('info.ejs', { student_info: result_student.rows, calendar, year, month, daydate });
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
            res.redirect('/notice/teaNotFound');
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
    const page = String(req.params.notice);

    // เช็คว่าได้ล็อคอินยัง
    if(!req.session.isLogin){
        return res.redirect('/login');
    }

    // ฟังชั่นเปลี่ยนหน้า
    if(page == 'addstudent'){
        res.render('notice.ejs');
    }else{ //ส่งแจ้งเตือนปกติ
        res.render('management.ejs', {checklogin: req.session });
    }
});

// หน้าแสดง error
app.get('/notice/:err', (req, res) => {
    res.render('notice.ejs');
});

app.listen(port,() => {
    console.log(`Server is running on port ${port}`);
});