/* MindGPS free mail dispatcher. Deploy as the owner. Never place OAuth tokens in source.
 * Required Script Properties: FIREBASE_PROJECT_ID, FIREBASE_WEB_API_KEY.
 * Optional Script Property: APP_URL, the app address shown in alert emails.
 * Uses the owner's Google OAuth grant (datastore + send_mail), not a service-account key.
 * Browser supplies only an event reference and its Firebase ID token. All mail content and
 * recipient information come from validated Firestore records. No public arbitrary-mail API.
 */
var MAIL_VERSION = 'mindgps-mail-2026-10-11';
var DAILY_PROTECTION_CAP = 90;
var MAX_AUTOMATIC_ATTEMPTS = 3;

function doGet() { return json_({ service: 'MindGPS mail', version: MAIL_VERSION }); }

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents;
    if (typeof raw !== 'string' || raw.length > 16000) throw new Error('bad_request');
    var body = JSON.parse(raw);
    if (!validRecordId_(body.recordId) || typeof body.idToken !== 'string' || body.idToken.length > 12000) throw new Error('bad_request');
    var actor = verifyCaller_(body.idToken);
    var record = readDoc_('activityRecords/' + body.recordId);
    if (!record || !needsMail_(record)) throw new Error('not_found');
    var teacherRetry = body.retry === true && approvedTeacher_(actor, record.classId);
    if (record.createdBy !== actor && !teacherRetry) throw new Error('not_authorized');
    withMailLock_(function () {
      processDelivery_(body.recordId, deliveryEnvironment_(), { retry: teacherRetry, allowDuplicate: teacherRetry && body.allowDuplicate === true });
    });
    // The browser cannot read this no-cors response. It observes mailDeliveries/{id} instead.
    return json_({ accepted: true });
  } catch (error) {
    // Do not echo tokens, submitted data, addresses, or raw Google exception messages.
    return json_({ accepted: false });
  }
}

/** Install once after authorization. The immediate path is doPost; this recovers missed requests. */
function installRecoveryTrigger() {
  var existing = ScriptApp.getProjectTriggers().some(function (trigger) { return trigger.getHandlerFunction() === 'retryPendingMail'; });
  if (!existing) ScriptApp.newTrigger('retryPendingMail').timeBased().everyMinutes(1).create();
  retryPendingMail();
}

function retryPendingMail() {
  var started = Date.now();
  withMailLock_(function () {
    var jobs = queryDocs_('mailDeliveries', {
      compositeFilter: { op: 'AND', filters: [
        { fieldFilter: { field: { fieldPath: 'status' }, op: 'IN', value: encode_(['pending', 'failed', 'quota', 'sending']) } },
        { fieldFilter: { field: { fieldPath: 'nextAttemptAt' }, op: 'GREATER_THAN', value: encode_(new Date(0)) } },
        { fieldFilter: { field: { fieldPath: 'nextAttemptAt' }, op: 'LESS_THAN_OR_EQUAL', value: encode_(new Date()) } }
      ] }
    }, [{ field: { fieldPath: 'nextAttemptAt' }, direction: 'ASCENDING' }], 20);
    for (var i = 0; i < jobs.length && Date.now() - started < 45000; i++) {
      try { processDelivery_(jobs[i]._id, deliveryEnvironment_(), {}); } catch (error) { /* Keep pending state visible. */ }
    }
  });
  // A small heartbeat makes a missing/failed recovery trigger visible, without writing every minute.
  var cache = CacheService.getScriptCache();
  if (!cache.get('heartbeat')) {
    putDoc_('mailServiceHealth/current', { version: MAIL_VERSION, checkedAt: new Date(), remainingRecipients: MailApp.getRemainingDailyQuota(), protectionCap: DAILY_PROTECTION_CAP });
    cache.put('heartbeat', '1', 900);
  }
}

function withMailLock_(work) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1500)) return;
  try { work(); } finally { lock.releaseLock(); }
}

/** Pure orchestration with injectable I/O, exercised by Node tests without sending mail. */
function processDelivery_(id, env, options) {
  var item = env.read('mailDeliveries/' + id);
  if (!item || item.status === 'sent') return;
  var now = env.now();
  if (item.status === 'sending') {
    if (time_(item.nextAttemptAt) <= now.getTime()) {
      var sentRecord = env.read('activityRecords/' + id);
      var sentProof = sentRecord && env.read('mailDedupe/' + dedupeKey_(sentRecord, id, env.hash));
      if (sentProof && sentProof.status === 'sent') {
        env.finish(id, { status: 'sent', reason: 'sent', sentAt: sentProof.sentAt, updatedAt: now, nextAttemptAt: null });
      } else {
        env.patch('mailDeliveries/' + id, { status: 'unknown', reason: 'lease_expired', updatedAt: now, nextAttemptAt: null });
      }
    }
    return;
  }
  if (item.status === 'unknown' && !(options.retry && options.allowDuplicate)) return;
  if (!options.retry && item.attempts >= MAX_AUTOMATIC_ATTEMPTS) {
    if (item.nextAttemptAt) env.patch('mailDeliveries/' + id, { nextAttemptAt: null, updatedAt: now });
    return;
  }
  if (!options.retry && time_(item.nextAttemptAt) > now.getTime()) return;
  var record = env.read('activityRecords/' + id);
  if (!record || !needsMail_(record) || record.createdBy !== item.createdBy || record.classId !== item.classId) {
    env.patch('mailDeliveries/' + id, { status: 'failed', reason: 'record_invalid', updatedAt: now, nextAttemptAt: null, attempts: MAX_AUTOMATIC_ATTEMPTS }); return;
  }
  var session = env.read('learningSessions/' + record.createdBy + '_' + record.sessionId);
  var teacherUid = session && session.teacherUid;
  var approved = teacherUid && env.read('teachers/' + teacherUid);
  var classroom = env.read('classes/' + record.classId);
  var profile = teacherUid && env.read('teacherAlertProfiles/' + teacherUid);
  var validTeacher = session && session.classId === record.classId
    && (session.learnerCode === record.learnerCode || record.identifiedBy === 'teacher-after')
    && approved && approved.approved === true && classroom && classroom.teacherIds.indexOf(teacherUid) !== -1;
  if (!validTeacher || !profile || typeof profile.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
    env.patch('mailDeliveries/' + id, { status: 'failed', reason: validTeacher ? 'recipient_missing' : 'teacher_inactive',
      attempts: item.attempts + 1, updatedAt: now,
      nextAttemptAt: item.attempts + 1 < MAX_AUTOMATIC_ATTEMPTS ? new Date(now.getTime() + 300000) : null }); return;
  }
  var device = env.read('devices/' + record.createdBy);
  var dedupeId = dedupeKey_(record, id, env.hash);
  var previous = env.read('mailDedupe/' + dedupeId);
  if (previous && previous.status === 'sent') {
    env.finish(id, { status: 'sent', reason: 'deduplicated', sentAt: previous.sentAt, deduplicated: true,
      learnerCode: record.learnerCode, deviceLabel: device ? device.label : '등록 해제된 기기', updatedAt: now, nextAttemptAt: null }); return;
  }
  // A different event in the same phase must not bypass a possibly sent message's lease.
  if (previous && previous.recordId !== id && previous.status === 'sending') {
    env.patch('mailDeliveries/' + id, { status: 'unknown', reason: 'send_uncertain', updatedAt: now, nextAttemptAt: null }); return;
  }
  var quota = env.quota();
  if (quota <= 0 || !env.budgetAvailable(now)) {
    env.patch('mailDeliveries/' + id, { status: 'quota', reason: quota <= 0 ? 'quota' : 'daily_cap',
      updatedAt: now, nextAttemptAt: new Date(now.getTime() + 3600000) }); return;
  }
  var attempt = env.uuid();
  var lease = new Date(now.getTime() + 120000);
  // Persist BEFORE invoking MailApp. A crash must never be interpreted as a successful send,
  // nor automatically repeat a send which may already have reached Gmail.
  env.patch('mailDeliveries/' + id, { status: 'sending', reason: 'sending', attempts: item.attempts + 1,
    updatedAt: now, nextAttemptAt: lease, attemptId: attempt, teacherUid: teacherUid,
    learnerCode: record.learnerCode, deviceLabel: device ? device.label : '등록 해제된 기기' });
  env.put('mailDedupe/' + dedupeId, { status: 'sending', recordId: id, attemptId: attempt, updatedAt: now });
  env.consumeBudget(now);
  try {
    env.send(profile.email, {
      subject: '[마음GPS] 학생에게 도움이 필요해요',
      body: '마음GPS에서 도움이 필요한 기록이 도착했습니다.\n\n'
        + '반: ' + classroom.name + '\n학생 코드: ' + (record.learnerCode || '미지정 — 기기 사용 학생을 확인해 주세요')
        + '\n기기: ' + (device ? device.label : '등록 해제된 기기')
        + '\n이유: ' + (record.alertTrigger === 'help-button' ? '도움 요청 버튼을 누름' : '부정적인 감정 강도 5')
        + '\n\n학생의 상태를 직접 확인해 주세요.' + (env.appUrl && env.appUrl() ? '\n교사 화면: ' + env.appUrl() : '') + '\n기록 번호: ' + id
    });
  } catch (error) {
    env.patch('mailDeliveries/' + id, { status: 'unknown', reason: 'send_uncertain', updatedAt: env.now(), nextAttemptAt: null });
    return;
  }
  var sentAt = env.now();
  // Dedupe first. If updating the UI receipt fails, a retry will recover the sent receipt.
  env.put('mailDedupe/' + dedupeId, { status: 'sent', recordId: id, attemptId: attempt, sentAt: sentAt });
  env.finish(id, { status: 'sent', reason: 'sent', sentAt: sentAt, updatedAt: sentAt, nextAttemptAt: null });
}

function needsMail_(record) {
  return record.helpRequested === true || record.recordKind === 'help'
    || negativeFive_(record.emotion, record.intensity) || negativeFive_(record.afterEmotion, record.afterIntensity);
}
function negativeFive_(emotion, intensity) { return ['속상해요', '화가나요', '힘들어요'].indexOf(emotion) !== -1 && intensity === 5; }
function time_(value) { return value instanceof Date ? value.getTime() : value ? new Date(value).getTime() : 0; }
function dedupeKey_(record, id, hash) {
  if (record.alertTrigger === 'help-button') return hash('help|' + id);
  var phase = negativeFive_(record.afterEmotion, record.afterIntensity) ? 'after' : 'before';
  return hash(record.createdBy + '|' + record.sessionId + '|' + phase + '|negative-five');
}
function validRecordId_(id) { return typeof id === 'string' && /^[A-Za-z0-9_-]{1,230}$/.test(id); }
function json_(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }

function deliveryEnvironment_() {
  return {
    read: readDoc_, patch: patchDoc_, put: putDoc_, now: function () { return new Date(); }, uuid: function () { return Utilities.getUuid(); },
    hash: function (text) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text).map(function (byte) { return ('0' + (byte & 255).toString(16)).slice(-2); }).join(''); },
    quota: function () { return MailApp.getRemainingDailyQuota(); },
    appUrl: function () { return PropertiesService.getScriptProperties().getProperty('APP_URL') || ''; },
    budgetAvailable: function (now) { return budget_(now).count < DAILY_PROTECTION_CAP; },
    consumeBudget: function (now) { var data = budget_(now); data.count++; PropertiesService.getScriptProperties().setProperty('DAILY_SEND_BUDGET', JSON.stringify(data)); },
    send: function (to, message) { MailApp.sendEmail({ to: to, subject: message.subject, body: message.body, name: '마음GPS 알림' }); },
    finish: function (id, patch) {
      // Respect a teacher confirming support while an email is being sent.
      for (var i = 0; i < 3; i++) {
        var current = readDoc_('mailDeliveries/' + id);
        try { patchDoc_('mailDeliveries/' + id, Object.assign({}, patch, { closed: current.supportResolved === true }), current._updateTime); return; }
        catch (error) { if (i === 2) throw error; }
      }
    }
  };
}
function budget_(now) {
  var day = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd');
  var data = JSON.parse(PropertiesService.getScriptProperties().getProperty('DAILY_SEND_BUDGET') || '{}');
  return data.day === day ? data : { day: day, count: 0 };
}

function verifyCaller_(token) {
  var key = PropertiesService.getScriptProperties().getProperty('FIREBASE_WEB_API_KEY');
  if (!key) throw new Error('not_configured');
  var response = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(key), {
    method: 'post', contentType: 'application/json', payload: JSON.stringify({ idToken: token }), muteHttpExceptions: true,
  });
  if (response.getResponseCode() !== 200) throw new Error('not_authorized');
  var users = JSON.parse(response.getContentText()).users;
  if (!users || users.length !== 1 || users[0].disabled || !validRecordId_(users[0].localId)) throw new Error('not_authorized');
  return users[0].localId;
}
function approvedTeacher_(uid, classId) {
  var teacher = readDoc_('teachers/' + uid), classroom = readDoc_('classes/' + classId);
  return teacher && teacher.approved === true && classroom && classroom.teacherIds.indexOf(uid) !== -1;
}

function firestoreBase_() {
  var project = PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID');
  if (!project || !/^[a-z][a-z0-9-]+$/.test(project)) throw new Error('not_configured');
  return 'https://firestore.googleapis.com/v1/projects/' + project + '/databases/(default)/documents';
}
function request_(url, method, body) {
  var options = { method: method, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true };
  if (body) { options.contentType = 'application/json'; options.payload = JSON.stringify(body); }
  var response = UrlFetchApp.fetch(url, options), code = response.getResponseCode();
  if (code === 404 && method === 'get') return null;
  if (code < 200 || code >= 300) throw new Error('firestore_' + code);
  return JSON.parse(response.getContentText() || '{}');
}
function path_(value) {
  if (!/^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(value)) throw new Error('invalid_path');
  return value;
}
function readDoc_(path) {
  var data = request_(firestoreBase_() + '/' + path_(path), 'get');
  return data ? Object.assign(decodeFields_(data.fields || {}), { _updateTime: data.updateTime, _id: data.name.split('/').pop() }) : null;
}
function putDoc_(path, data) { return request_(firestoreBase_() + '/' + path_(path), 'patch', { fields: encodeFields_(data) }); }
function patchDoc_(path, data, updateTime) {
  var params = Object.keys(data).map(function (key) { return 'updateMask.fieldPaths=' + encodeURIComponent(key); });
  if (updateTime) params.push('currentDocument.updateTime=' + encodeURIComponent(updateTime));
  else params.push('currentDocument.exists=true');
  return request_(firestoreBase_() + '/' + path_(path) + '?' + params.join('&'), 'patch', { fields: encodeFields_(data) });
}
function queryDocs_(collection, filter, orderBy, maximum) {
  var data = request_(firestoreBase_() + ':runQuery', 'post', { structuredQuery: {
    from: [{ collectionId: collection }], where: filter, orderBy: orderBy, limit: maximum,
  } });
  return data.filter(function (row) { return row.document; }).map(function (row) { return Object.assign(decodeFields_(row.document.fields), { _id: row.document.name.split('/').pop() }); });
}
function encodeFields_(data) { var result = {}; Object.keys(data).forEach(function (key) { result[key] = encode_(data[key]); }); return result; }
function encode_(value) {
  if (value == null) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode_) } };
  return { mapValue: { fields: encodeFields_(value) } };
}
function decodeFields_(fields) { var result = {}; Object.keys(fields).forEach(function (key) { result[key] = decode_(fields[key]); }); return result; }
function decode_(value) {
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return new Date(value.timestampValue);
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode_);
  return decodeFields_(value.mapValue.fields || {});
}
