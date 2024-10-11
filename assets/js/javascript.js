
// ฟังชั่นค้นหา
document.getElementById('searchBox').addEventListener('keyup', function() {
    const searchValue = this.value.toLowerCase();
    const tableRows = document.querySelectorAll('#searchTable tr');

    tableRows.forEach(row => {
    const rowText = row.textContent.toLowerCase();
    if (rowText.includes(searchValue)) {
        row.style.display = ''; // แสดงแถวที่ตรงกับการค้นหา
    } else {
        row.style.display = 'none'; // ซ่อนแถวที่ไม่ตรง
    }
    });
});

// ปุ่มแก้ไขข้อมูล
function editData(page, id){

    // แจ้งเตือน
    Swal.fire({
        title: "คำเตือน?",
        text: "คุณต้องการแก้ไขข้อมูลใช่หรือไม่!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "ใช่",
        cancelButtonText: "ไม่"
    }).then((result) => {
        if (result.isConfirmed) {
          window.location.href = page+id;
        }
    });
}

// ปุ่มลบข้อมูล
function delData(page, id){
    Swal.fire({
        title: "คำเตือน?",
        text: "คุณต้องการลบข้อมูลใช่หรือไม่!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "ใช่",
        cancelButtonText: "ไม่"
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = page+id;
        }
    });
}

// ฟังชั่นแจ้งเตือน

const url = window.location.pathname; //เช็คที่อยู่

var cut_url = url.lastIndexOf('/');
var notice = url.substring(cut_url + 1);
var page = url.substring(0, cut_url);


// แจ้งเตือนแก้ไขข้อมูล
if(notice == 'edSuccess'){
    const Toast = Swal.mixin({
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 1000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.onmouseenter = Swal.stopTimer;
            toast.onmouseleave = Swal.resumeTimer;
        },
        didClose: () => {
            // เปลี่ยนหน้า
            window.location.href = page;
        }
    });
        Toast.fire({
        icon: "success",
        title: "แก้ไขข้อมูลสำเร็จ"
    });
    
}

// แจ้งเตือนลบข้อมูลสำเร็จ
if(notice == 'delSuccess'){
    const Toast = Swal.mixin({
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 1000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.onmouseenter = Swal.stopTimer;
            toast.onmouseleave = Swal.resumeTimer;
        },
        didClose: () => {
            // เปลี่ยนหน้า
            window.location.href = page;
        }
    });
        Toast.fire({
        icon: "success",
        title: "ลบข้อมูลสำเร็จ"
    });
    
}