// =========================================================================
// 1. 키즈노트 투약의뢰서 관련 상수 설정
// =========================================================================
var CENTER_ID = 52548;
var SESSION_CACHE_KEY = 'kidsnote_sessionid_v1';
var SESSION_TTL_SEC = 6 * 60 * 60; // 6시간 캐싱

// =========================================================================
// 2. GET 요청 처리 (기존 학생 명렬표 및 캘린더 연동)
// =========================================================================
function doGet(e) {
  try {
    // 앱에서 어떤 데이터를 요청했는지 확인 (기본값은 'all')
    var type = e.parameter.type || "all";
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // ──────────────────────────────────────────────────
    // 1. 원아 데이터 (학생 명렬표 시트 연동)
    // ──────────────────────────────────────────────────
    var studentResult = { students: {}, classes: [] };

    if (type === "all" || type === "students") {
      var sheetStudents = ss.getSheetByName("아동 명렬표");
      if (sheetStudents) {
        var data = sheetStudents.getDataRange().getValues();
        var classSet = {};

        for (var i = 1; i < data.length; i++) {
          var row = data[i];
          var name = row[1]; // B열: 이름
          if (!name || name === "") continue;

          var className = row[2] || "미분류"; // C열: 반
          var rawDate = row[3]; // D열: 생년월일
          var birthdate = "";

          if (rawDate instanceof Date) {
            birthdate = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
          } else {
            birthdate = String(rawDate).trim();
          }

          var studentObj = {
            id: String(row[0]),
            name: String(name),
            className: String(className),
            birthdate: birthdate,
            gender: String(row[4]),
            contact: String(row[5]),
            status: String(row[6])
          };

          if (!studentResult.students[className]) studentResult.students[className] = [];
          studentResult.students[className].push(studentObj);

          if (!classSet[className]) {
            classSet[className] = true;
            studentResult.classes.push({ id: className, name: className });
          }
        }
      }
    }

    // ──────────────────────────────────────────────────
    // 2. 구글 캘린더 (센트럴파크 어린이집 일정표) 직접 연동
    // ──────────────────────────────────────────────────
    var calendarResult = { widget: [], list: [] };

    if (type === "all" || type === "calendar") {
      // 💡 사용자님의 구글 캘린더 이름으로 직접 검색
      var calendars = CalendarApp.getCalendarsByName("센트럴파크 어린이집 일정표");

      if (calendars.length > 0) {
        var calendar = calendars[0];

        // 일정 가져올 기간 설정 (예: 1달 전부터 6개월 후까지)
        var now = new Date();
        var startTime = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        var endTime = new Date(now.getFullYear(), now.getMonth() + 6, 0);

        var events = calendar.getEvents(startTime, endTime);

        for (var j = 0; j < events.length; j++) {
          var ev = events[j];
          var cDate = ev.getStartTime();
          var formattedCalDate = Utilities.formatDate(cDate, Session.getScriptTimeZone(), "yyyy-MM-dd");

          var eventObj = {
            date: formattedCalDate,
            title: ev.getTitle(),
            description: ev.getDescription() || ""
          };

          calendarResult.list.push(eventObj);
          calendarResult.widget.push(eventObj);
        }
      }
    }

    // ──────────────────────────────────────────────────
    // 3. 요청 타입(?type=)에 따라 알맞은 데이터 응답
    // ──────────────────────────────────────────────────
    if (type === "students") {
      return ContentService.createTextOutput(JSON.stringify(studentResult))
        .setMimeType(ContentService.MimeType.JSON);
    }
    else if (type === "calendar") {
      return ContentService.createTextOutput(JSON.stringify(calendarResult))
        .setMimeType(ContentService.MimeType.JSON);
    }
    else {
      var combinedResult = {
        students: studentResult.students,
        classes: studentResult.classes,
        calendar: calendarResult
      };
      return ContentService.createTextOutput(JSON.stringify(combinedResult))
        .setMimeType(ContentService.MimeType.JSON);
    }

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// =========================================================================
// 3. POST 요청 처리 (키즈노트 투약의뢰서 로그인 및 데이터 수집)
// =========================================================================
function doPost(e) {
  try {
    // RN 앱에서 text/plain으로 데이터를 보내도, 내용은 JSON이므로 여기서 파싱합니다.
    var body = JSON.parse(e.postData.contents || '{}');
    var username = body.username;
    var password = body.password;

    if (!username || !password) {
      return _json({ ok: false, error: 'missing_credentials' });
    }

    var cache = CacheService.getScriptCache();
    var sessionId = cache.get(SESSION_CACHE_KEY);
    var source = 'cache';

    // 1) 캐시된 쿠키로 시도
    if (sessionId) {
      var r1 = _fetchMedications(sessionId);
      if (r1.status === 200) {
        return _json({ ok: true, results: r1.results, source: source });
      }
      // 세션 만료이거나 에러면 캐시 삭제 후 재로그인 플로우로 넘어감
      if (r1.status === 401 || r1.status === 403) {
        cache.remove(SESSION_CACHE_KEY);
        sessionId = null;
      } else {
        return _json({ ok: false, error: 'kidsnote_error', status: r1.status, detail: r1.body });
      }
    }

    // 2) 로그인 -> 새 쿠키 발급 -> 캐싱
    var login = _login(username, password);
    if (!login.ok) {
      return _json({ ok: false, error: 'login_failed', detail: login.detail });
    }

    cache.put(SESSION_CACHE_KEY, login.sessionId, SESSION_TTL_SEC);
    source = 'login';

    // 3) 새 쿠키로 투약의뢰서 가져오기
    var r2 = _fetchMedications(login.sessionId);
    if (r2.status !== 200) {
      return _json({ ok: false, error: 'kidsnote_error_after_login', status: r2.status, detail: r2.body });
    }

    return _json({ ok: true, results: r2.results, source: source });

  } catch (err) {
    return _json({ ok: false, error: 'exception', detail: String(err) });
  }
}

// =========================================================================
// 4. 키즈노트 API 연동 헬퍼 함수들
// =========================================================================
function _login(username, password) {
  var resp = UrlFetchApp.fetch('https://www.kidsnote.com/api/web/login/', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      username: username,
      password: password,
      remember_me: false
    }),
    muteHttpExceptions: true,
    followRedirects: false
  });

  var code = resp.getResponseCode();
  if (code !== 200 && code !== 201) {
    return { ok: false, detail: 'http_' + code + ':' + resp.getContentText().slice(0, 200) };
  }

  var headers = resp.getAllHeaders();
  var setCookie = headers['Set-Cookie'] || headers['set-cookie'];
  if (!setCookie) return { ok: false, detail: 'no_set_cookie' };

  var cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (var i = 0; i < cookies.length; i++) {
    var m = cookies[i].match(/sessionid=([^;]+)/);
    if (m) return { ok: true, sessionId: m[1] };
  }

  return { ok: false, detail: 'sessionid_not_found' };
}

function _fetchMedications(sessionId) {
  var url = 'https://www.kidsnote.com/api/v1_2/centers/' + CENTER_ID + '/medications?page_size=50';
  var resp = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'Cookie': 'sessionid=' + sessionId },
    muteHttpExceptions: true
  });

  var code = resp.getResponseCode();
  var text = resp.getContentText();

  if (code !== 200) return { status: code, body: text.slice(0, 500) };

  try {
    var parsed = JSON.parse(text);
    var raw = parsed.results || [];
    var results = raw.map(function (r) {
      var child = r.child || {};
      var rawItems = r.items || [];

      // items 배열을 방어적으로 정규화 — upstream 필드명이 달라질 수 있으므로
      // 여러 후보 키를 순서대로 시도하여 첫 non-empty 값을 채택.
      var items = rawItems.map(function (it, idx) {
        return {
          // 기존 핵심 필드
          medicine_type: _pick(it, ['medicine_type','medicineType','medicine','name']) || '',
          dosage: _pick(it, ['dosage','dose','amount']) || '',
          medication_time: _pick(it, ['medication_time','medicationTime','time','timing']) || '',
          special_note: _pick(it, ['special_note','specialNote','note','memo','remark']) || null,
          // [NEW] 증상
          symptoms: _pick(it, ['symptoms','symptom','description','complaint','condition','illness']) || null,
          // [NEW] 보관방법
          storage_method: _pick(it, ['storage_method','storageMethod','storage','preserve_method','preservation','storage_type']) || null,
          // [NEW] 횟수 — 실제 필드가 있으면 사용, 없으면 배열 인덱스 기반 1,2,3…
          dose_count: _pick(it, ['number','order','dose_number','doseNumber','count','dose_count','doseCount','sequence','index','times','no']) || (idx + 1),
          // 디버그: upstream item의 실제 키 목록 — 실기기에서 1회 확인 후 후보 키를 고정할 수 있음
          _debug_keys: Object.keys(it || {})
        };
      });

      return {
        child_name: r.child_name || child.name || '',
        date_medicated: r.date_medicated || '',
        // 담당 반 필터용 — upstream 스키마에 따라 방어적으로 여러 경로 점검
        belong_to_class:
          (typeof r.belong_to_class !== 'undefined' && r.belong_to_class !== null)
            ? r.belong_to_class
            : (child.belong_to_class || null),
        class_name:
          r.class_name || child.class_name || (r.class && r.class.name) || '',
        items: items
      };
    });
    return { status: 200, results: results };
  } catch (e) {
    return { status: 502, body: 'parse_error' };
  }
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** 객체에서 후보 키 목록을 순서대로 확인 → 처음 발견된 non-empty 값 반환 */
function _pick(obj, keys) {
  if (!obj) return null;
  for (var i = 0; i < keys.length; i++) {
    var v = obj[keys[i]];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}

// =========================================================================
// 5. [DEBUG] Kidsnote 원본 응답 덤프 — Apps Script 에디터에서 직접 실행
// =========================================================================
/**
 * 사전 준비 (1회만):
 *   프로젝트 설정(톱니바퀴) → 스크립트 속성 → 속성 추가
 *     TEST_USERNAME = (키즈노트 ID)
 *     TEST_PASSWORD = (키즈노트 PW)
 *
 * 실행 방법:
 *   에디터 상단 함수 드롭다운에서 "_devDumpRawItem" 선택 → ▶ 실행 클릭
 *   → "실행 → 실행 로그"에서 결과 확인
 *
 * 이 함수는 웹앱 배포를 거치지 않고 스크립트를 직접 실행하므로,
 * 배포 버전 불일치 문제와 무관하게 Kidsnote 원본 응답을 100% 정확히 볼 수 있음.
 */
function _devDumpRawItem() {
  var props = PropertiesService.getScriptProperties();
  var u = props.getProperty('TEST_USERNAME');
  var p = props.getProperty('TEST_PASSWORD');
  if (!u || !p) {
    Logger.log('⚠️ Script Properties에 TEST_USERNAME / TEST_PASSWORD를 먼저 저장하세요.');
    return;
  }

  var login = _login(u, p);
  if (!login.ok) {
    Logger.log('❌ 로그인 실패: ' + login.detail);
    return;
  }
  Logger.log('✅ 로그인 성공');

  var url = 'https://www.kidsnote.com/api/v1_2/centers/' + CENTER_ID + '/medications?page_size=5';
  var resp = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'Cookie': 'sessionid=' + login.sessionId },
    muteHttpExceptions: true
  });

  if (resp.getResponseCode() !== 200) {
    Logger.log('❌ HTTP ' + resp.getResponseCode() + ': ' + resp.getContentText().slice(0, 500));
    return;
  }

  var parsed = JSON.parse(resp.getContentText());
  var records = parsed.results || [];
  Logger.log('📋 받은 record 수: ' + records.length);

  if (records.length === 0) {
    Logger.log('⚠️ record 없음 (오늘 투약의뢰서가 없거나 필터링됨)');
    return;
  }

  var first = records[0];
  Logger.log('');
  Logger.log('===== 🔍 첫 번째 record 최상위 키 =====');
  Logger.log(JSON.stringify(Object.keys(first)));

  var items = first.items || [];
  Logger.log('');
  Logger.log('===== 🔍 items 배열 길이: ' + items.length + ' =====');

  if (items.length > 0) {
    Logger.log('');
    Logger.log('===== ⭐ 첫 번째 item 키 목록 (이게 핵심!) =====');
    Logger.log(JSON.stringify(Object.keys(items[0])));

    Logger.log('');
    Logger.log('===== ⭐ 첫 번째 item 전체 내용 =====');
    Logger.log(JSON.stringify(items[0], null, 2));
  }

  Logger.log('');
  Logger.log('===== 📦 첫 번째 record 전체 덤프 (child 포함) =====');
  Logger.log(JSON.stringify(first, null, 2));
}
