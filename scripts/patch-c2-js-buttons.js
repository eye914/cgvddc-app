/**
 * C-2 디자인 — cgv-app.js 동적 버튼 패치
 * Unicode escape 문자열로 정확히 매칭
 */
const fs = require('fs');
const path = require('path');
const appPath = path.join(__dirname, '..', 'public', 'cgv-app.js');
let c = fs.readFileSync(appPath, 'utf8');
let ok = 0;

function rep(desc, oldStr, newStr) {
    if (c.includes(oldStr)) {
        c = c.split(oldStr).join(newStr);
        console.log(desc + ': OK');
        ok++;
    } else {
        console.log(desc + ': 마커 없음 (스킵)');
    }
}

// 1. 지원하기 버튼 (isSub 분기)
rep('지원하기 버튼',
    '\"+(isSub?\"bg-orange-500 hover:bg-orange-600\":\"bg-blue-600 hover:bg-blue-700\")+\" text-white py-4 rounded-2xl font-black transition-all shadow-md\'>\\uC9C0\\uC6D0\\uD558\\uAE30</button>\"',
    '\"+(isSub?\"btn-c2 btn-c2-orange\":\"btn-c2 btn-c2-blue\")+\" py-4 rounded-2xl font-black\'>\\uC9C0\\uC6D0\\uD558\\uAE30</button>\"'
);

// 2. 수락 버튼
rep('수락 버튼',
    "class='flex-1 bg-green-600 text-white py-4 rounded-2xl font-black shadow-md'>\\uC218\\uB77D</button>",
    "class='flex-1 btn-c2 btn-c2-green py-4 rounded-2xl font-black'>\\uC218\\uB77D</button>"
);

// 3. 거절 버튼
rep('거절 버튼',
    "class='flex-1 bg-slate-800 text-white py-4 rounded-2xl font-black shadow-md'>\\uAC70\\uC808</button>",
    "class='flex-1 btn-c2 btn-c2-ghost py-4 rounded-2xl font-black'>\\uAC70\\uC808</button>"
);

// 4. 소규모 취소 버튼
rep('소규모 취소 버튼',
    "class='text-[11px] bg-white text-red-400 border border-red-200 px-3 py-1.5 rounded-lg active:scale-95 font-black shadow-sm'>\\uCDE8\\uC18C</button>",
    "class='text-[11px] btn-c2 btn-c2-danger px-3 py-1.5 rounded-lg active:scale-95 font-black'>\\uCDE8\\uC18C</button>"
);

// 5. 관리자 삭제 버튼 (실시간현황)
rep('관리자 삭제 버튼',
    "class='text-[11px] bg-white text-slate-400 border border-slate-200 px-3 py-1.5 rounded-lg active:scale-95 font-black shadow-sm'>\\uC0AD\\uC81C</button>",
    "class='text-[11px] btn-c2 btn-c2-ghost px-3 py-1.5 rounded-lg active:scale-95 font-black'>\\uC0AD\\uC81C</button>"
);

// 6. 관리자 최종 승인 버튼
rep('최종 승인 버튼',
    "class='flex-1 bg-slate-900 text-white py-5 rounded-2xl font-black shadow-md'>\\uCD5C\\uC885 \\uC2B9\\uC778</button>",
    "class='flex-1 btn-c2 btn-c2-dark py-5 rounded-2xl font-black'>\\uCD5C\\uC885 \\uC2B9\\uC778</button>"
);

// 7. 관리자 반려 버튼
rep('반려 버튼',
    "class='flex-1 bg-red-600 text-white py-5 rounded-2xl font-black shadow-md'>\\uBC18\\uB824</button>",
    "class='flex-1 btn-c2 btn-c2-primary py-5 rounded-2xl font-black'>\\uBC18\\uB824</button>"
);

// 8. 관리자 공고 취소 버튼 (admin 뷰)
rep('공고 취소(관리자) 버튼',
    "class='w-full mt-2 bg-white text-slate-400 border border-slate-200 py-3 rounded-2xl font-black text-sm'>\\uACF5\\uACE0 \\uCDE8\\uC18C (\\uAD00\\uB9AC\\uC790)</button>",
    "class='w-full mt-2 btn-c2 btn-c2-ghost py-3 rounded-2xl font-black text-sm'>\\uACF5\\uACE0 \\uCDE8\\uC18C (\\uAD00\\uB9AC\\uC790)</button>"
);

// 9. 인라인 취소 버튼 (모집중 카드 상단)
rep('인라인 취소 버튼',
    "class='ml-auto text-[10px] bg-white text-red-400 border border-red-200 px-2 py-0.5 rounded-md font-black'>\\uCDE8\\uC18C</button>",
    "class='ml-auto text-[10px] btn-c2 btn-c2-danger px-2 py-0.5 rounded-md font-black'>\\uCDE8\\uC18C</button>"
);

fs.writeFileSync(appPath, c, 'utf8');
console.log('\ncgv-app.js 저장 완료 (' + ok + '/' + 9 + ' 패치)');

try { new Function(c); console.log('JS 문법 OK'); }
catch(e) { console.log('JS 문법 에러:', e.message); }
