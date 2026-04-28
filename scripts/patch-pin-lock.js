/**
 * PIN 5자리 통일 + 이름 고정 패치
 */
const fs = require('fs');
const path = require('path');
const appJsPath = path.join(__dirname, '..', 'public', 'cgv-app.js');
let c = fs.readFileSync(appJsPath, 'utf8');

// 1. 관리자 PIN 5자리로 통일
c = c.replace('var PIN_LENGTH_ADMIN = 4;', 'var PIN_LENGTH_ADMIN = 5;');
console.log('1. PIN_LENGTH_ADMIN=5:', c.indexOf('var PIN_LENGTH_ADMIN = 5;') > -1 ? 'OK' : 'FAIL');

// 2. authSuccess: staff 로그인 시 이름 고정
const oldSuccess = `        function authSuccess(r) {
            var ov = document.getElementById('auth-overlay');
            ov.style.opacity = '0';
            setTimeout(function(){ ov.style.display = 'none'; }, 400);
            sessionStorage.setItem('cgv_auth','true');
            if (r.role === 'admin') {
                isAdmin = true; sessionStorage.setItem('cgv_admin','true');
            } else {
                sessionStorage.setItem('cgv_currentUser', authSelectedName);
                selectUser(authSelectedName);
            }
            fetchData();
        }`;

const newSuccess = `        function authSuccess(r) {
            var ov = document.getElementById('auth-overlay');
            ov.style.opacity = '0';
            setTimeout(function(){ ov.style.display = 'none'; }, 400);
            sessionStorage.setItem('cgv_auth','true');
            if (r.role === 'admin') {
                isAdmin = true;
                sessionStorage.setItem('cgv_admin','true');
                sessionStorage.setItem('cgv_admin_name', r.name || '관리자');
            } else {
                sessionStorage.setItem('cgv_currentUser', authSelectedName);
                sessionStorage.setItem('cgv_locked_user', authSelectedName); // PIN 로그인 이름 고정
                selectUser(authSelectedName);
            }
            fetchData();
        }`;

c = c.replace(oldSuccess, newSuccess);
console.log('2. authSuccess locked_user:', c.indexOf('cgv_locked_user') > -1 ? 'OK' : 'FAIL');

// 3. openUserSelectModal: 이름 고정 시 변경 차단
const oldOpen = `        function openUserSelectModal(){
            // 미리보기/로컬 환경에서 MISO_DATA가 비어있으면 fallback 채움`;
const newOpen = `        function openUserSelectModal(){
            // PIN 로그인 후 이름 변경 차단
            if (sessionStorage.getItem('cgv_locked_user')) {
                alert('PIN 로그인 후에는 본인 계정만 사용 가능합니다. 다른 이름으로 사용하려면 앱을 재시작하세요.');
                return;
            }
            // 미리보기/로컬 환경에서 MISO_DATA가 비어있으면 fallback 채움`;

c = c.replace(oldOpen, newOpen);
console.log('3. openUserSelectModal 차단:', c.indexOf('PIN 로그인 후에는 본인') > -1 ? 'OK' : 'FAIL');

// 4. selectUser: 고정 상태면 자물쇠 표시
const oldSelectUser = `            btn.innerHTML = "<span class='text-slate-900 font-black text-xl'>"+name+" <span class='text-[15px] text-slate-500 font-semibold'>("+currentUserPos.join(", ")+")</span></span><span class='bg-slate-800 text-white px-3 py-1.5 rounded-lg font-black tracking-widest uppercase shadow-md'>변경</span>";`;
const newSelectUser = `            var isLocked = !!sessionStorage.getItem('cgv_locked_user');
            var changeBtn = isLocked
                ? "<span class='text-slate-400 text-lg px-2'>🔒</span>"
                : "<span class='bg-slate-800 text-white px-3 py-1.5 rounded-lg font-black tracking-widest uppercase shadow-md'>변경</span>";
            btn.innerHTML = "<span class='text-slate-900 font-black text-xl'>"+name+" <span class='text-[15px] text-slate-500 font-semibold'>("+currentUserPos.join(", ")+")</span></span>" + changeBtn;`;

c = c.replace(oldSelectUser, newSelectUser);
console.log('4. selectUser 자물쇠:', c.indexOf('cgv_locked_user') > 200 ? 'OK' : 'FAIL');

// 5. window.onload 세션 복원시 locked_user도 복원
const oldRestore = `                var saved = sessionStorage.getItem("cgv_currentUser");
                if (saved) selectUser(saved);`;
const newRestore = `                if (sessionStorage.getItem('cgv_admin') === 'true') isAdmin = true;
                var saved = sessionStorage.getItem("cgv_currentUser");
                if (saved) selectUser(saved);`;

// 중복 방지: 이미 있으면 스킵
if (c.indexOf(newRestore) < 0) {
    c = c.replace(oldRestore, newRestore);
    console.log('5. onload admin restore: OK');
} else {
    console.log('5. onload admin restore: already patched');
}

fs.writeFileSync(appJsPath, c, 'utf8');
console.log('\n전체 완료!');
