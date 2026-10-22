// The 10 forms: one definition used by both the browser and the server,
// so what you see while typing is exactly what gets checked on submit.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RH_FORMS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const YES_NO = [['yes', 'Yes'], ['no', 'No']];

  const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
  const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  const mins = (s) => { const p = s.split(':').map(Number); return p[0] * 60 + p[1]; };
  const dayNum = (s) => Math.round(Date.parse(s + 'T00:00:00Z') / 86400000);
  const round2 = (n) => Math.round(n * 100) / 100;

  function fmtDate(s) {
    if (!isDate(s)) return s;
    return new Date(s + 'T00:00:00Z').toLocaleDateString('en-US',
      { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
  }
  function fmtTime(s) {
    if (!isTime(s)) return s;
    const p = s.split(':').map(Number);
    return ((p[0] % 12) || 12) + ':' + String(p[1]).padStart(2, '0') + ' ' + (p[0] < 12 ? 'AM' : 'PM');
  }
  const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');

  const FORMS = {
    leave: {
      label: 'Leave', blurb: 'Sick, vacation or emergency leave',
      fields: [
        { key: 'leaveType', label: 'Leave type', type: 'select',
          options: [['sick', 'Sick leave'], ['vacation', 'Vacation leave'], ['emergency', 'Emergency leave']] },
        { key: 'startDate', label: 'First day of leave', type: 'date' },
        { key: 'endDate', label: 'Last day of leave', type: 'date' },
      ],
      reasonLabel: 'Reason',
      computedLabels: { days: 'Number of days' },
      check(c) {
        const days = dayNum(c.endDate) - dayNum(c.startDate) + 1;
        if (days < 1) return { error: 'The last day must be on or after the first day.' };
        if (days > 365) return { error: 'Leave cannot be longer than 365 days.' };
        return { computed: { days } };
      },
      summary: (d, c) => ({ sick: 'Sick', vacation: 'Vacation', emergency: 'Emergency' }[d.leaveType]) + ' leave, ' +
        fmtDate(d.startDate) + ' to ' + fmtDate(d.endDate) + ' (' + plural(c.days, 'day') + ')',
    },
    undertime: {
      label: 'Undertime', blurb: 'Leaving before the end of your shift',
      fields: [
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'scheduledEnd', label: 'Scheduled end of shift', type: 'time' },
        { key: 'timeLeaving', label: 'Time you are leaving', type: 'time' },
      ],
      reasonLabel: 'Reason',
      computedLabels: { hours: 'Undertime (hours)' },
      check(c) {
        const h = (mins(c.scheduledEnd) - mins(c.timeLeaving)) / 60;
        if (h <= 0) return { error: 'The time you are leaving must be before the end of your shift.' };
        return { computed: { hours: round2(h) } };
      },
      summary: (d, c) => 'Leaving ' + fmtTime(d.timeLeaving) + ' on ' + fmtDate(d.date) + ' (' + c.hours + ' h undertime)',
    },
    outgoing: {
      label: 'Outgoing', blurb: 'Gate pass for going out during work',
      fields: [
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'timeOut', label: 'Time out', type: 'time' },
        { key: 'expectedBack', label: 'Expected time back', type: 'time' },
        { key: 'destination', label: 'Destination', type: 'text' },
      ],
      reasonLabel: 'Purpose',
      check(c) {
        if (mins(c.expectedBack) <= mins(c.timeOut)) return { error: 'The expected time back must be after the time out.' };
        return { computed: {} };
      },
      summary: (d) => 'Out ' + fmtTime(d.timeOut) + ' to ' + fmtTime(d.expectedBack) + ' on ' + fmtDate(d.date) + ', to ' + d.destination,
    },
    overtime: {
      label: 'Overtime', blurb: 'Work beyond your regular hours',
      fields: [
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'startTime', label: 'Start time', type: 'time' },
        { key: 'endTime', label: 'End time', type: 'time' },
      ],
      reasonLabel: 'Task or reason',
      computedLabels: { hours: 'Overtime (hours)' },
      check(c) {
        let d = mins(c.endTime) - mins(c.startTime);
        if (d <= 0) d += 1440; // finishing after midnight
        const h = d / 60;
        if (h > 16) return { error: 'Overtime cannot be longer than 16 hours.' };
        return { computed: { hours: round2(h) } };
      },
      summary: (d, c) => fmtDate(d.date) + ', ' + fmtTime(d.startTime) + ' to ' + fmtTime(d.endTime) + ' (' + c.hours + ' h)',
    },
    incident: {
      label: 'Incident report', blurb: 'Report an accident or incident',
      fields: [
        { key: 'incidentDate', label: 'Date of incident', type: 'date' },
        { key: 'incidentTime', label: 'Time of incident', type: 'time' },
        { key: 'location', label: 'Location', type: 'text' },
        { key: 'peopleInvolved', label: 'People involved', type: 'text', optional: true },
      ],
      reasonLabel: 'What happened',
      summary: (d) => d.location + ', ' + fmtDate(d.incidentDate),
    },
    materialGatePass: {
      label: 'Material gate pass', blurb: 'Take materials or items out of the plant',
      fields: [
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'items', label: 'Items and quantities (one per line)', type: 'textarea' },
        { key: 'destination', label: 'Destination', type: 'text' },
        { key: 'returning', label: 'Will the items come back?', type: 'select', options: YES_NO },
      ],
      reasonLabel: 'Purpose',
      summary: (d) => 'Materials to ' + d.destination + ' on ' + fmtDate(d.date),
    },
    cashAdvance: {
      label: 'Cash advance / loan', blurb: 'Request a cash advance or loan',
      fields: [
        { key: 'amount', label: 'Amount (PHP)', type: 'number' },
        { key: 'repayment', label: 'Preferred repayment (for example, deducted over 3 months)', type: 'text' },
      ],
      reasonLabel: 'Purpose',
      summary: (d) => 'PHP ' + Number(d.amount).toLocaleString('en-US'),
    },
    timeCorrection: {
      label: 'Time correction', blurb: 'Certificate of attendance or fix a time record',
      fields: [
        { key: 'date', label: 'Date to correct', type: 'date' },
        { key: 'correctTimeIn', label: 'Correct time in', type: 'time', optional: true },
        { key: 'correctTimeOut', label: 'Correct time out', type: 'time', optional: true },
      ],
      reasonLabel: 'Reason',
      check(c) {
        if (!c.correctTimeIn && !c.correctTimeOut) return { error: 'Enter the correct time in, the correct time out, or both.' };
        return { computed: {} };
      },
      summary: (d) => 'Time correction for ' + fmtDate(d.date),
    },
    equipment: {
      label: 'Equipment / supplies', blurb: 'Request equipment or supplies',
      fields: [
        { key: 'items', label: 'Items and quantities (one per line)', type: 'textarea' },
        { key: 'neededBy', label: 'Needed by', type: 'date', optional: true },
      ],
      reasonLabel: 'Purpose',
      summary: (d) => String(d.items).split('\n')[0].slice(0, 80),
    },
    shiftChange: {
      label: 'Schedule / shift change', blurb: 'Change your work schedule or shift',
      fields: [
        { key: 'currentSchedule', label: 'Current schedule', type: 'text' },
        { key: 'requestedSchedule', label: 'Requested schedule', type: 'text' },
        { key: 'fromDate', label: 'From', type: 'date' },
        { key: 'toDate', label: 'Until', type: 'date' },
      ],
      reasonLabel: 'Reason',
      check(c) {
        if (dayNum(c.toDate) < dayNum(c.fromDate)) return { error: 'The "Until" date must be on or after the "From" date.' };
        return { computed: {} };
      },
      summary: (d) => d.currentSchedule + ' to ' + d.requestedSchedule + ' from ' + fmtDate(d.fromDate),
    },
  };

  const allFields = (def) => def.fields.concat([{ key: 'reason', label: def.reasonLabel || 'Reason', type: 'textarea' }]);

  // Returns { errors, clean, computed }. errors is empty when the form is valid.
  function validate(type, input) {
    const def = FORMS[type];
    const errors = {}; const clean = {};
    input = input || {};
    allFields(def).forEach((f) => {
      let v = input[f.key];
      v = v == null ? '' : String(v).trim();
      if (!v) { if (!f.optional) errors[f.key] = f.label + ' is required.'; return; }
      if (f.type === 'text' && v.length > 200) errors[f.key] = f.label + ' is too long.';
      else if (f.type === 'textarea' && v.length > 2000) errors[f.key] = f.label + ' is too long.';
      else if (f.type === 'date' && !isDate(v)) errors[f.key] = 'Enter a valid date for "' + f.label + '".';
      else if (f.type === 'time' && !isTime(v)) errors[f.key] = 'Enter a valid time for "' + f.label + '".';
      else if (f.type === 'select' && !f.options.some((o) => o[0] === v)) errors[f.key] = 'Choose an option for "' + f.label + '".';
      else if (f.type === 'number') {
        const n = Number(v);
        if (!isFinite(n) || n <= 0 || n > 10000000) errors[f.key] = 'Enter a valid amount.';
        else v = n;
      }
      if (!errors[f.key]) clean[f.key] = v;
    });
    let computed = {};
    if (!Object.keys(errors).length && def.check) {
      const r = def.check(clean);
      if (r.error) errors._form = r.error; else computed = r.computed || {};
    }
    return { errors, clean, computed };
  }

  function summary(type, data, computed) {
    const def = FORMS[type];
    return def ? def.summary(data || {}, computed || {}) : type;
  }

  // Label and display value for every field, for the request view.
  function rows(type, data, computed) {
    const def = FORMS[type];
    if (!def) return [];
    const out = [];
    allFields(def).forEach((f) => {
      let v = (data || {})[f.key];
      if (v == null || v === '') return;
      if (f.type === 'select') { const o = f.options.find((x) => x[0] === v); v = o ? o[1] : v; }
      else if (f.type === 'date') v = fmtDate(v);
      else if (f.type === 'time') v = fmtTime(v);
      else if (f.type === 'number') v = 'PHP ' + Number(v).toLocaleString('en-US');
      out.push([f.label, String(v)]);
    });
    const labels = def.computedLabels || {};
    Object.keys(labels).forEach((k) => {
      if (computed && computed[k] != null) out.push([labels[k], String(computed[k])]);
    });
    return out;
  }

  return { FORMS, validate, summary, rows, fmtDate, fmtTime };
});
