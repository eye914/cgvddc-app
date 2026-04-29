/**
 * GAS google.script.run shim
 * google.script.run.withSuccessHandler(fn).withFailureHandler(fn).method(args)
 * → fetch('/api/...') 로 변환
 */
(function() {
  function makeRunner() {
    var _success = function(){};
    var _failure = function(e){ alert('오류: ' + (e && e.message ? e.message : e)); };

    var runner = {
      withSuccessHandler: function(fn) { _success = fn; return runner; },
      withFailureHandler: function(fn) { _failure = fn; return runner; },

      // ── 교대 공고 ──
      getTradesFromDB: function() {
        fetch('/api/trades').then(function(r){ return r.json(); }).then(_success).catch(_failure);
      },
      saveTradeToDB: function(tradeData) {
        fetch('/api/trades', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(tradeData) })
          .then(function(r){ return r.json(); }).then(function(d){ if(d.error) throw new Error(d.error); _success(d); }).catch(_failure);
      },
      updateTradeInDB: function(id, updateData) {
        fetch('/api/trades', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(Object.assign({id:id}, updateData)) })
          .then(function(r){ return r.json(); }).then(function(d){ if(d.error) throw new Error(d.error); _success(d); }).catch(_failure);
      },
      deleteTradeFromDB: function(id) {
        fetch('/api/trades', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id:id}) })
          .then(function(r){ return r.json(); }).then(function(d){ if(d.error) throw new Error(d.error); _success(d); }).catch(_failure);
      },
      deleteOldTrades: function(days) {
        fetch('/api/trades', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({days:days}) })
          .then(function(r){ return r.json(); }).then(function(d){ if(d.error) throw new Error(d.error); _success(d && d.deleted != null ? d.deleted : 0); }).catch(_failure);
      },

      // ── 푸시 알림 ──
      subscribePush: function(name, subscription) {
        fetch('/api/push/subscribe', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:name, subscription:subscription}) })
          .then(function(r){ return r.json(); }).then(function(d){ if(d.error) throw new Error(d.error); _success(d); }).catch(_failure);
      },
      testPush: function(name) {
        fetch('/api/push/test', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:name}) })
          .then(function(r){ return r.json(); }).then(function(d){ if(d.error) throw new Error(d.error); _success(d); }).catch(_failure);
      },

      // ── 인증 ──
      checkPinAuth: function(name, pin, role) {
        fetch('/api/auth', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:name, pin:pin, role:role}) })
          .then(function(r){ return r.json(); }).then(function(d){ if(d.error) throw new Error(d.error); _success(d); }).catch(_failure);
      },
      updateStaffPin: function(name, pin) {
        fetch('/api/misojigi', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:name, pin:pin}) })
          .then(function(r){ return r.json(); }).then(function(d){ if(d.error) throw new Error(d.error); _success(d); }).catch(_failure);
      },

      // ── 미소지기 ──
      getMisojigiFromDB: function() {
        fetch('/api/misojigi').then(function(r){ return r.json(); }).then(_success).catch(_failure);
      },
      getAllMisojigiForAdmin: function() {
        fetch('/api/misojigi?all=1').then(function(r){ return r.json(); }).then(_success).catch(_failure);
      },
      addMisojigi: function(name, pos, hours, employeeId) {
        fetch('/api/misojigi', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:name, pos:pos, hours:hours, employeeId:employeeId}) })
          .then(function(r){ return r.json(); }).then(function(d){ if(d.error) throw new Error(d.error); _success(d); }).catch(_failure);
      },
      updateMisojigi: function(name, updates) {
        fetch('/api/misojigi', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(Object.assign({name:name}, updates)) })
          .then(function(r){ return r.json(); }).then(function(d){ if(d.error) throw new Error(d.error); _success(d); }).catch(_failure);
      },
      deactivateMisojigi: function(name) {
        fetch('/api/misojigi', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:name}) })
          .then(function(r){ return r.json(); }).then(function(d){ if(d.error) throw new Error(d.error); _success(d); }).catch(_failure);
      },

      // ── 출결 ──
      getAttendanceFromDB: function() {
        fetch('/api/attendance').then(function(r){ return r.json(); }).then(_success).catch(_failure);
      },
      saveAttendanceToDB: function(name, week, late, absent, logs) {
        fetch('/api/attendance', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:name, week:week, late:late, absent:absent, logs:logs}) })
          .then(function(r){ return r.json(); }).then(function(d){ if(d && d.error) throw new Error(d.error); _success(d); }).catch(_failure);
      },
    };
    return runner;
  }

  window.google = {
    script: {
      run: new Proxy({}, {
        get: function(_, prop) {
          if (prop === 'withSuccessHandler' || prop === 'withFailureHandler') {
            return makeRunner()[prop].bind(makeRunner());
          }
          return makeRunner()[prop] ? function() {
            return makeRunner()[prop].apply(null, arguments);
          } : function() {};
        }
      })
    }
  };

  // PWA Service Worker 등록
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js').catch(function(e) {
        console.log('SW 등록 실패:', e);
      });
    });
  }
})();
