import { useState, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis
} from "recharts";

// ── 유틸 ──────────────────────────────────────────────────
function formatTime(s) {
  if (!s || isNaN(s)) return "--:--";
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = Math.floor(s%60);
  if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  return `${m}:${String(sec).padStart(2,"0")}`;
}
function formatPace(s) {
  if (!s || isNaN(s)) return "--'--\"";
  return `${Math.floor(s/60)}'${String(Math.floor(s%60)).padStart(2,"0")}"`;
}
function parseTime(str) {
  if (!str) return NaN;
  const p = str.trim().split(":").map(Number);
  if (p.some(isNaN)) return NaN;
  if (p.length === 3) return p[0]*3600+p[1]*60+p[2];
  if (p.length === 2) return p[0]*60+p[1];
  return NaN;
}
function riegel(t1, d1, d2) { return t1 * Math.pow(d2/d1, 1.06); }

const DIST = { "5K":5, "10K":10, "하프마라톤":21.0975, "풀마라톤":42.195 };
const TYPES = ["LSD","인터벌","템포런","회복런","레이스"];
const TC = { LSD:"#3A7BD5", 인터벌:"#D53A3A", 템포런:"#3AD57B", 회복런:"#3AC8D5", 레이스:"#FF5C00" };

const SAMPLE = [
  {id:1,date:"2026-01-20",distance:10,timeInput:"56:20",type:"LSD"},
  {id:2,date:"2026-01-25",distance:5, timeInput:"24:50",type:"인터벌"},
  {id:3,date:"2026-02-01",distance:15,timeInput:"1:28:30",type:"LSD"},
  {id:4,date:"2026-02-08",distance:10,timeInput:"54:10",type:"템포런"},
  {id:5,date:"2026-02-15",distance:21,timeInput:"2:04:00",type:"LSD"},
  {id:6,date:"2026-02-22",distance:10,timeInput:"52:40",type:"템포런"},
  {id:7,date:"2026-03-01",distance:5, timeInput:"23:20",type:"인터벌"},
  {id:8,date:"2026-03-08",distance:25,timeInput:"2:28:00",type:"LSD"},
  {id:9,date:"2026-03-15",distance:10,timeInput:"51:30",type:"템포런"},
];

function getPredictionComment(name, secs) {
  const table = {
    "풀마라톤":[[3*3600,"🏅 서브3 — 엘리트급 (상위 0.1%)"],[3*3600+30*60,"🥇 서브3:30 — 실업팀급"],[4*3600,"🥈 서브4 — 상위 5%"],[4*3600+30*60,"🥉 서브4:30 — 꾸준한 훈련의 결실"],[5*3600,"👏 서브5 — 완주+경쟁 수준"],[Infinity,"🏃 계속 달리면 반드시 빨라집니다"]],
    "하프마라톤":[[1*3600+30*60,"🏅 서브1:30 — 하프 고수"],[1*3600+45*60,"🥇 서브1:45 — 상위 10%"],[2*3600,"🥈 서브2 — 충분히 빠른 러너"],[Infinity,"🏃 꾸준히 하면 분명히 빨라집니다"]],
    "10K":[[40*60,"🏅 서브40분 — 엘리트"],[45*60,"🥇 서브45분 — 상위 5%"],[50*60,"🥈 서브50분 — 꾸준한 훈련자"],[60*60,"🥉 서브60분 — 안정적 러너"],[Infinity,"🏃 10K 완주, 훌륭합니다"]],
    "5K":[[20*60,"🏅 서브20분 — 5K 고수"],[25*60,"🥇 서브25분 — 상위 15%"],[30*60,"🥈 서브30분 — 꾸준한 러너"],[Infinity,"🏃 5K 완주, 건강한 시작"]],
  };
  for (const [lim,msg] of (table[name]||[])) { if (secs < lim) return msg; }
  return "";
}

function buildWeekPlan(goalPaceSec, weeksLeft) {
  const phase = weeksLeft > 12 ? "빌드업" : weeksLeft > 6 ? "피크" : "테이퍼";
  const gp=formatPace(goalPaceSec), ep=formatPace(goalPaceSec*1.25), tp=formatPace(goalPaceSec*1.05), ip=formatPace(goalPaceSec*0.95);
  const plans = {
    빌드업:[
      {day:"월",icon:"💤",type:"휴식",  intensity:"휴식",  km:"—",   label:"완전 휴식 또는 폼롤러·스트레칭 15분"},
      {day:"화",icon:"⚡",type:"인터벌",intensity:"고강도",km:"10km", label:`1km × 6회 반복 (${ip}/km) + 워밍업·쿨다운 각 2km`},
      {day:"수",icon:"💧",type:"회복런",intensity:"저강도",km:"8km",  label:`8km 아주 천천히 (${ep}/km) — 몸 회복 집중`},
      {day:"목",icon:"🔥",type:"템포런",intensity:"중강도",km:"16km", label:`목표 페이스에 가깝게 16km (${tp}/km)`},
      {day:"금",icon:"💤",type:"휴식",  intensity:"휴식",  km:"—",   label:"완전 휴식 또는 요가·코어 운동 20분"},
      {day:"토",icon:"🏃",type:"LSD",   intensity:"중강도",km:"30km", label:`장거리 천천히 28~32km (${ep}/km) — 유산소 기반 강화`},
      {day:"일",icon:"💧",type:"회복런",intensity:"저강도",km:"8km",  label:`8~10km 가볍게 (${ep}/km) — 다리 풀어주기`},
    ],
    피크:[
      {day:"월",icon:"💤",type:"휴식",  intensity:"휴식",  km:"—",   label:"완전 휴식 또는 스트레칭 20분"},
      {day:"화",icon:"⚡",type:"인터벌",intensity:"고강도",km:"12km", label:`1km × 8회 반복 (${ip}/km) + 워밍업·쿨다운 각 2km`},
      {day:"수",icon:"💧",type:"회복런",intensity:"저강도",km:"10km", label:`10km 회복런 (${ep}/km)`},
      {day:"목",icon:"🔥",type:"템포런",intensity:"중강도",km:"20km", label:`목표 페이스로 20km (${tp}/km)`},
      {day:"금",icon:"💤",type:"휴식",  intensity:"휴식",  km:"—",   label:"완전 휴식 — 피크 훈련 전 완전 회복"},
      {day:"토",icon:"🏃",type:"LSD",   intensity:"중강도",km:"33km", label:`장거리 32~35km (${ep}/km) — 시즌 최장 훈련`},
      {day:"일",icon:"💧",type:"회복런",intensity:"저강도",km:"10km", label:`10km 가볍게 (${ep}/km)`},
    ],
    테이퍼:[
      {day:"월",icon:"💤",type:"휴식",  intensity:"휴식",  km:"—",   label:"완전 휴식 — 근육 충전 집중"},
      {day:"화",icon:"⚡",type:"인터벌",intensity:"중강도",km:"8km",  label:`1km × 4회 반복 (${ip}/km) — 감각 유지`},
      {day:"수",icon:"💧",type:"회복런",intensity:"저강도",km:"6km",  label:`6km 아주 천천히 (${ep}/km)`},
      {day:"목",icon:"🔥",type:"템포런",intensity:"중강도",km:"10km", label:`목표 페이스로 10km (${gp}/km) — 감각 점검`},
      {day:"금",icon:"💤",type:"휴식",  intensity:"휴식",  km:"—",   label:"완전 휴식 — 대회 3일 전 충분한 수면"},
      {day:"토",icon:"🏃",type:"LSD",   intensity:"저강도",km:"16km", label:"16km 편안하게 — 마지막 긴 훈련"},
      {day:"일",icon:"💧",type:"회복런",intensity:"저강도",km:"5km",  label:"5~6km 아주 천천히 — 다리 가볍게 유지"},
    ],
  };
  return { phase, plan: plans[phase] };
}

// 부상 부위 정보
const INJURY_PARTS = [
  { id:"knee",   label:"무릎",     icon:"🦵", desc:"장경인대 증후군, 슬개건염", treatment:"2~3일 휴식 → 폼롤러 IT밴드·대퇴사두근 마사지 → 냉찜질 15분 × 3회/일 → 의심 시 정형외과" },
  { id:"calf",   label:"종아리",   icon:"🦶", desc:"종아리 근경련, 아킬레스건염", treatment:"휴식 + 스트레칭 (종아리 벽 밀기 30초 × 3세트) → 마그네슘 보충 고려 → 통증 1주 이상 지속 시 병원" },
  { id:"foot",   label:"발",       icon:"👟", desc:"족저근막염, 피로골절", treatment:"족저근막염: 아침 기상 시 발바닥 스트레칭 필수, 인솔 교체. 피로골절 의심 시 즉시 훈련 중단 + X-ray" },
  { id:"hip",    label:"고관절·엉덩이", icon:"🏃", desc:"고관절 굴곡근 긴장", treatment:"스트레칭 (피전 포즈 30초 × 좌우) + 글루트 강화 운동 (클램쉘, 힙 브릿지) → 3일 이상 지속 시 병원" },
  { id:"shin",   label:"정강이",   icon:"🦴", desc:"정강이 통증 (shin splints)", treatment:"즉시 고강도 훈련 중단 → 냉찜질 + 압박 → 훈련량 30% 감소 → 2주 이상 지속 시 피로골절 확인" },
  { id:"back",   label:"허리·등",  icon:"💪", desc:"허리 근육 긴장", treatment:"코어 강화 (플랭크, 버드독) + 고강도 훈련 일시 중단 → 디스크 의심 시 즉시 전문의 상담" },
];

// 심리 체크 항목
const MENTAL_CHECKS = [
  { key:"motivation", label:"훈련 동기",   icons:["😔","😐","🙂","😊","🔥"] },
  { key:"sleep",      label:"수면 질",     icons:["😴","😪","😐","🙂","😌"] },
  { key:"stress",     label:"일상 스트레스 (낮을수록 좋음)", icons:["😤","😟","😐","😊","😎"] },
  { key:"confidence", label:"레이스 자신감",icons:["😰","😟","😐","🙂","💪"] },
];

// ── CSS ───────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600;700&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  body{background:#07070F;}
  ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-thumb{background:#FF5C00;border-radius:2px;}
  .app{font-family:'Outfit',sans-serif;background:#07070F;min-height:100vh;color:#E2DDD5;}

  .header{background:#07070F;border-bottom:1px solid #181828;position:sticky;top:0;z-index:99;}
  .header-inner{max-width:800px;margin:0 auto;padding:0 20px;}
  .logo-row{display:flex;align-items:baseline;gap:10px;padding:16px 0 0;}
  .logo{font-family:'Bebas Neue';font-size:34px;color:#FF5C00;letter-spacing:.07em;}
  .logo-sub{font-size:12px;color:#383848;letter-spacing:.16em;text-transform:uppercase;font-weight:600;}

  .tabs{display:flex;gap:3px;padding-top:12px;align-items:flex-end;overflow-x:auto;}
  .tabs::-webkit-scrollbar{height:0;}
  .tab{background:#0C0C1A;border:1px solid #1A1A30;border-bottom:none;
    color:#44445A;font-family:'Outfit',sans-serif;font-size:12.5px;font-weight:700;
    letter-spacing:.05em;padding:10px 16px 12px;cursor:pointer;white-space:nowrap;
    border-radius:10px 10px 0 0;transition:all .2s;position:relative;top:1px;flex-shrink:0;}
  .tab:hover{color:#AA8855;background:#111120;}
  .tab.active{background:#07070F;border-color:#282840;color:#FF5C00;border-bottom:1px solid #07070F;z-index:2;}
  .tab-line{height:1px;background:#282840;margin:0 -20px;position:relative;z-index:1;}

  .body{max-width:800px;margin:0 auto;padding:24px 20px 70px;display:flex;flex-direction:column;gap:18px;}
  .card{background:#0C0C1A;border:1px solid #181828;border-radius:14px;padding:22px;}
  .slabel{font-family:'Bebas Neue';font-size:20px;letter-spacing:.06em;color:#E2DDD5;margin-bottom:14px;}
  .slabel.or{color:#FF5C00;} .slabel.gr{color:#3AD57B;} .slabel.bl{color:#3A7BD5;} .slabel.pu{color:#AA77FF;}

  .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  .field label{display:block;font-size:12px;color:#555568;letter-spacing:.1em;text-transform:uppercase;font-weight:700;margin-bottom:7px;}
  .field input,.field select{width:100%;background:#101020;border:1px solid #1E1E30;
    color:#E2DDD5;border-radius:8px;padding:12px 15px;font-size:15px;font-family:'Outfit',sans-serif;outline:none;transition:border-color .2s;}
  .field input:focus,.field select:focus{border-color:#FF5C00;}
  .field select option{background:#101020;}
  .btn{background:#FF5C00;color:#fff;border:none;border-radius:9px;padding:13px;font-size:14px;font-weight:700;letter-spacing:.05em;cursor:pointer;width:100%;margin-top:14px;transition:background .2s,transform .1s;}
  .btn:hover{background:#FF7A2E;transform:translateY(-1px);}

  /* Upload */
  .upload-zone{border:2px dashed #282840;border-radius:10px;padding:22px;text-align:center;cursor:pointer;transition:border-color .2s,background .2s;background:#0A0A18;}
  .upload-zone:hover,.upload-zone.drag{border-color:#FF5C00;background:#FF5C0008;}
  .upload-icon{font-size:32px;margin-bottom:8px;}
  .upload-text{font-size:13px;color:#555568;line-height:1.7;}
  .upload-text strong{color:#FF8C44;}
  .ai-result{background:#0A0A18;border:1px solid #FF5C0040;border-radius:9px;padding:14px 16px;margin-top:12px;}
  .ai-result-title{font-size:11px;color:#FF8C44;letter-spacing:.1em;text-transform:uppercase;font-weight:700;margin-bottom:10px;}
  .ai-chips{display:flex;flex-wrap:wrap;gap:8px;}
  .ai-chip{background:#1A1A30;border-radius:6px;padding:6px 12px;font-size:13px;color:#E2DDD5;}
  .ai-chip span{color:#FF8C44;font-weight:700;margin-left:5px;}

  /* Log */
  .log-header{display:grid;grid-template-columns:74px 50px 88px 88px 68px;gap:8px;padding-bottom:10px;border-bottom:1px solid #181828;}
  .log-header span{font-size:11px;color:#383848;letter-spacing:.09em;text-transform:uppercase;font-weight:700;}
  .log-scroll{max-height:280px;overflow-y:auto;}
  .log-row{display:grid;grid-template-columns:74px 50px 88px 88px 68px;gap:8px;padding:10px 0;border-bottom:1px solid #0F0F1E;align-items:center;}
  .log-row:last-child{border-bottom:none;}
  .badge{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:3px 8px;border-radius:5px;}

  /* Stats */
  .stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
  .stat-box{background:#101020;border-radius:9px;padding:14px 15px;}
  .stat-label{font-size:11px;color:#555568;letter-spacing:.09em;text-transform:uppercase;font-weight:700;margin-bottom:6px;}
  .stat-val{font-family:'Bebas Neue';font-size:28px;letter-spacing:.04em;line-height:1;}

  /* Prediction */
  .pred-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  .pred-card{background:#0C0C1A;border:1px solid #181828;border-radius:12px;padding:18px;transition:border-color .2s,transform .2s;}
  .pred-card:hover{border-color:#FF5C00;transform:translateY(-2px);}
  .pred-label{font-size:12px;color:#555568;letter-spacing:.09em;text-transform:uppercase;font-weight:700;margin-bottom:7px;}
  .pred-time{font-family:'Bebas Neue';font-size:36px;color:#E2DDD5;letter-spacing:.04em;line-height:1;}
  .pred-pace{font-size:13px;color:#FF8C44;margin-top:5px;}
  .pred-comment{font-size:12px;color:#887766;margin-top:7px;line-height:1.5;}

  /* D-day */
  .dday-row{display:flex;gap:12px;}
  .dday-box{flex:1;background:#101020;border-radius:10px;padding:18px;text-align:center;}
  .dday-num{font-family:'Bebas Neue';font-size:48px;line-height:1;}

  /* Week plan */
  .week-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
  .phase-badge{font-size:12px;font-weight:700;letter-spacing:.07em;padding:5px 14px;border-radius:20px;background:#FF5C0020;color:#FF8C44;border:1px solid #FF5C0040;}
  .day-plan{display:flex;flex-direction:column;gap:8px;}
  .day-row{display:grid;grid-template-columns:30px 28px 1fr 50px;gap:10px;background:#101020;border-radius:9px;padding:12px 14px;align-items:center;transition:background .2s;}
  .day-row:hover{background:#14142A;}
  .day-name{font-family:'Bebas Neue';font-size:20px;color:#E2DDD5;letter-spacing:.05em;}
  .day-icon{font-size:18px;text-align:center;}
  .day-desc{font-size:13px;color:#CCCCDD;line-height:1.5;}
  .day-type-tag{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:3px 8px;border-radius:4px;display:inline-block;margin-bottom:5px;}
  .day-km{font-size:12px;color:#FF8C44;font-weight:700;text-align:right;}
  .i-high{background:#D53A3A22;color:#D53A3A;} .i-mid{background:#FFB54722;color:#FFB547;}
  .i-low{background:#3A7BD522;color:#3A7BD5;}  .i-rest{background:#33333322;color:#555568;}

  /* Guide */
  .guide-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
  .guide-item{background:#101020;border-radius:9px;padding:14px 15px;}
  .guide-icon{font-size:22px;margin-bottom:7px;}
  .guide-title{font-size:12px;color:#FF8C44;font-weight:700;letter-spacing:.04em;margin-bottom:4px;}
  .guide-body{font-size:12px;color:#887766;line-height:1.65;}

  /* Tip */
  .tip{background:#FF5C0010;border:1px solid #FF5C0028;border-radius:9px;padding:15px 17px;font-size:13px;color:#CC8855;line-height:1.75;}
  .tip-blue{background:#3A7BD510;border:1px solid #3A7BD528;border-radius:9px;padding:15px 17px;font-size:13px;color:#6AABDD;line-height:1.75;}
  .tip-green{background:#3AD57B10;border:1px solid #3AD57B28;border-radius:9px;padding:15px 17px;font-size:13px;color:#5ACC8A;line-height:1.75;}
  .tip-purple{background:#AA77FF10;border:1px solid #AA77FF28;border-radius:9px;padding:15px 17px;font-size:13px;color:#BB99FF;line-height:1.75;}

  /* Progress */
  .prog-bar{height:6px;background:#1A1A2E;border-radius:3px;overflow:hidden;margin-top:12px;}
  .prog-fill{height:100%;background:linear-gradient(90deg,#FF5C00,#FFB547);border-radius:3px;transition:width 1s ease;}
  .prog-labels{display:flex;justify-content:space-between;font-size:12px;color:#555568;margin-bottom:6px;}

  /* ──────── 건강관리 탭 ──────── */
  /* 심리 체크 */
  .mental-grid{display:flex;flex-direction:column;gap:14px;}
  .mental-row{background:#101020;border-radius:10px;padding:14px 16px;}
  .mental-label{font-size:13px;color:#CCCCDD;font-weight:600;margin-bottom:10px;}
  .emoji-row{display:flex;gap:8px;}
  .emoji-btn{background:#0C0C1A;border:1px solid #1A1A30;border-radius:8px;
    padding:8px 12px;font-size:22px;cursor:pointer;transition:all .2s;flex:1;text-align:center;}
  .emoji-btn:hover{border-color:#FF5C00;background:#FF5C0010;}
  .emoji-btn.sel{border-color:#FF5C00;background:#FF5C0020;transform:scale(1.1);}
  .mental-result{background:#101020;border-radius:10px;padding:18px;}
  .mental-score-row{display:flex;align-items:center;gap:14px;margin-bottom:10px;}
  .mental-score{font-family:'Bebas Neue';font-size:52px;line-height:1;}
  .mental-msg{font-size:14px;color:#CCCCDD;line-height:1.7;}

  /* 부상 관리 */
  .injury-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
  .injury-card{background:#101020;border-radius:10px;padding:14px;cursor:pointer;
    border:1px solid transparent;transition:all .2s;}
  .injury-card:hover{border-color:#D53A3A50;}
  .injury-card.sel{border-color:#D53A3A;background:#D53A3A10;}
  .injury-icon{font-size:24px;margin-bottom:6px;}
  .injury-name{font-size:13px;font-weight:700;color:#E2DDD5;margin-bottom:3px;}
  .injury-sub{font-size:11px;color:#555568;line-height:1.5;}
  .injury-detail{background:#0A0A18;border:1px solid #D53A3A40;border-radius:10px;padding:18px;margin-top:4px;}
  .injury-detail-title{font-size:13px;font-weight:700;color:#D53A3A;margin-bottom:8px;}
  .injury-detail-body{font-size:13px;color:#CCCCDD;line-height:1.8;}

  /* 훈련 페이스 조절 */
  .pace-adjust-table{display:flex;flex-direction:column;gap:8px;}
  .pace-week-row{display:grid;grid-template-columns:60px 1fr 90px 90px;gap:10px;
    background:#101020;border-radius:8px;padding:11px 14px;align-items:center;}
  .pace-week-row.now{background:#FF5C0018;border:1px solid #FF5C0040;}
  .pace-week-num{font-family:'Bebas Neue';font-size:18px;color:#FF8C44;}
  .pace-week-bar-wrap{height:8px;background:#1A1A2E;border-radius:4px;overflow:hidden;}
  .pace-week-bar{height:100%;border-radius:4px;transition:width 1s;}
  .pace-week-target{font-size:12px;color:#CCCCDD;font-weight:600;text-align:right;}
  .pace-week-vol{font-size:11px;color:#555568;text-align:right;}

  /* 체중 관리 */
  .weight-input-row{display:flex;gap:10px;align-items:flex-end;}
  .weight-list{display:flex;flex-direction:column;gap:6px;margin-top:14px;max-height:220px;overflow-y:auto;}
  .weight-row{display:grid;grid-template-columns:80px 70px 70px 1fr;gap:10px;
    background:#101020;border-radius:8px;padding:10px 13px;align-items:center;font-size:13px;}
  .weight-impact{font-size:12px;padding:3px 9px;border-radius:5px;font-weight:700;text-align:center;}

  /* Spinner */
  @keyframes spin{to{transform:rotate(360deg);}}
  .spinner{width:22px;height:22px;border:3px solid #FF5C0040;border-top-color:#FF5C00;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
  .fade{animation:fadeUp .3s ease forwards;}

  @media(max-width:540px){
    .form-grid,.pred-grid,.guide-grid,.injury-grid{grid-template-columns:1fr;}
    .stat-grid{grid-template-columns:1fr 1fr;}
    .dday-row{flex-wrap:wrap;}
    .log-header,.log-row{grid-template-columns:62px 44px 76px 76px 60px;}
    .day-row{grid-template-columns:28px 24px 1fr 46px;}
    .tab{font-size:11.5px;padding:9px 12px 11px;}
    .pace-week-row{grid-template-columns:50px 1fr 80px;}
  }
`;

// ── MAIN ──────────────────────────────────────────────────
export default function RunLab() {
  const TABS = ["훈련기록","목표설정","기록예측","건강관리"];
  const [tab, setTab] = useState("훈련기록");
  const [logs, setLogs] = useState(SAMPLE);
  const [form, setForm] = useState({date:"",distance:"",timeInput:"",type:"LSD"});
  const [goalRace, setGoalRace] = useState("풀마라톤");
  const [goalTime, setGoalTime] = useState("3:30:00");
  const [targetDate, setTargetDate] = useState("2026-11-01");
  const [uploading, setUploading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef();

  // 건강관리 state
  const [mentalScores, setMentalScores] = useState({motivation:null,sleep:null,stress:null,confidence:null});
  const [selectedInjury, setSelectedInjury] = useState(null);
  const [weights, setWeights] = useState([
    {id:1,date:"2026-01-01",kg:72.5},{id:2,date:"2026-02-01",kg:71.8},
    {id:3,date:"2026-03-01",kg:70.6},{id:4,date:"2026-04-01",kg:69.9},
  ]);
  const [weightForm, setWeightForm] = useState({date:"",kg:""});
  const [height, setHeight] = useState(173);
  const [raceWeight, setRaceWeight] = useState(68);

  // ── 계산 ──
  const bestRecord = (() => {
    let best = null;
    logs.forEach(l => {
      const s = parseTime(l.timeInput);
      if (!isNaN(s) && l.distance > 0) {
        const pace = s/l.distance;
        if (!best || pace < best.pace) best = {pace, distance:l.distance, time:s, timeInput:l.timeInput};
      }
    });
    return best;
  })();

  const predictions = bestRecord
    ? Object.entries(DIST).map(([name,dist]) => {
        const secs = riegel(bestRecord.time, bestRecord.distance, dist);
        return {name, dist, secs, pace:secs/dist, comment:getPredictionComment(name,secs)};
      })
    : [];

  const weeklyData = (() => {
    const map = {};
    logs.forEach(l => {
      const d = new Date(l.date);
      const wk = `${d.getMonth()+1}/${Math.ceil(d.getDate()/7)}주`;
      const key = l.date.slice(0,7)+wk;
      if (!map[key]) map[key] = {week:wk,LSD:0,인터벌:0,템포런:0,회복런:0,레이스:0};
      map[key][l.type] = (map[key][l.type]||0) + l.distance;
    });
    return Object.values(map);
  })();

  const paceTrend = logs.map(l => {
    const s = parseTime(l.timeInput);
    if (isNaN(s)||l.distance<=0) return null;
    return {date:l.date.slice(5), pace:Math.round(s/l.distance), type:l.type};
  }).filter(Boolean);

  const goalSecs       = parseTime(goalTime);
  const goalDist       = DIST[goalRace];
  const goalPace       = goalDist&&goalSecs ? goalSecs/goalDist : null;
  const currentForGoal = bestRecord&&goalDist ? riegel(bestRecord.time,bestRecord.distance,goalDist) : null;
  const gapSecs        = currentForGoal&&goalSecs ? currentForGoal-goalSecs : null;
  const weeksLeft      = targetDate ? Math.max(0,Math.floor((new Date(targetDate)-new Date())/(7*86400000))) : 0;
  const progressPct    = currentForGoal&&goalSecs ? Math.min(100,Math.max(0,(1-gapSecs/currentForGoal)*100)) : 0;
  const {phase, plan:dayPlan} = goalPace ? buildWeekPlan(goalPace,weeksLeft) : {phase:"빌드업",plan:[]};

  // 주간 페이스 조절 계획 (현재 → 목표 선형 보간)
  const paceAdjustPlan = (() => {
    if (!bestRecord||!goalPace||weeksLeft<1) return [];
    const currentPace = bestRecord.pace;
    const totalWeeks = Math.min(weeksLeft, 16);
    return Array.from({length:Math.min(8,totalWeeks)}, (_,i) => {
      const w = i+1;
      const ratio = w/totalWeeks;
      const targetPaceSec = currentPace - (currentPace-goalPace) * ratio;
      // 훈련량: 빌드업이면 증가, 테이퍼면 감소
      const baseVol = phase==="테이퍼" ? 65-i*8 : phase==="피크" ? 65+i*3 : 40+i*4;
      return {
        week:`${w}주차`, targetPace:Math.round(targetPaceSec),
        vol:Math.max(20,Math.min(80,baseVol)), isNow:i===0
      };
    });
  })();

  // 체중-기록 영향 계산 (1kg 감소 ≈ 2~3초/km 개선)
  const currentWeight = weights.length>0 ? weights[weights.length-1].kg : null;
  const weightImpact = currentWeight && bestRecord ? (() => {
    const diff = currentWeight - raceWeight;
    const secPerKmImprove = diff * 2.5;
    const newPace = bestRecord.pace - secPerKmImprove;
    const newFullTime = newPace * 42.195;
    const currentFullTime = bestRecord.pace * 42.195;
    return { diff, secPerKm:secPerKmImprove, newPace, newFullTime, currentFullTime,
             timeSave: currentFullTime - newFullTime };
  })() : null;

  const bmi = currentWeight && height ? (currentWeight / ((height/100)**2)).toFixed(1) : null;
  const weightTrend = weights.map(w => ({date:w.date.slice(5), kg:w.kg}));

  // 심리 점수 합산
  const mentalTotal = Object.values(mentalScores).filter(v=>v!==null).length;
  const mentalAvg = mentalTotal===4
    ? Math.round(Object.values(mentalScores).reduce((a,b)=>a+b,0)/4 * 20)
    : null;
  function getMentalMsg(score) {
    if (score>=80) return {msg:"훈련 컨디션 최상입니다! 이 상태를 유지하며 계획대로 훈련하세요. 🔥", color:"#3AD57B"};
    if (score>=60) return {msg:"전반적으로 양호합니다. 부족한 항목을 하나씩 개선하면 기록에 직접 반영됩니다. 💪", color:"#FFB547"};
    if (score>=40) return {msg:"다소 지쳐있을 수 있습니다. 1~2일 충분한 휴식을 우선하세요. 수면이 최고의 회복입니다. 😌", color:"#FF8C44"};
    return {msg:"오늘은 쉬는 날입니다. 훈련 강행은 역효과입니다. 몸이 회복을 요청하고 있어요. 💤", color:"#D53A3A"};
  }

  function addLog() {
    const {date,distance,timeInput,type} = form;
    if (!date||!distance||!timeInput) return;
    setLogs(p=>[...p,{...form,id:Date.now(),distance:Number(distance)}]);
    setForm({date:"",distance:"",timeInput:"",type:"LSD"});
    setAiResult(null);
  }

  function addWeight() {
    if (!weightForm.date||!weightForm.kg) return;
    setWeights(p=>[...p,{id:Date.now(),date:weightForm.date,kg:Number(weightForm.kg)}]);
    setWeightForm({date:"",kg:""});
  }

  async function analyzeImage(file) {
    if (!file) return;
    setUploading(true); setAiResult(null);
    try {
      const b64 = await new Promise((res,rej)=>{
        const r=new FileReader(); r.onload=()=>res(r.result.split(",")[1]); r.onerror=()=>rej(); r.readAsDataURL(file);
      });
      const resp = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:400,messages:[{role:"user",content:[
          {type:"image",source:{type:"base64",media_type:file.type||"image/jpeg",data:b64}},
          {type:"text",text:`이 이미지는 스마트워치 또는 러닝 앱의 운동 기록 화면입니다.\n다음 정보를 JSON으로만 반환하세요 (설명 없이, 마크다운 없이):\n{"date":"YYYY-MM-DD","distance":숫자(km),"time":"HH:MM:SS 또는 MM:SS","type":"LSD|인터벌|템포런|회복런|레이스"}\n찾을 수 없는 항목은 null로. type은 페이스와 거리를 보고 추론.`}
        ]}]})
      });
      const data = await resp.json();
      const txt = data.content?.find(c=>c.type==="text")?.text||"";
      const parsed = JSON.parse(txt.replace(/```json|```/g,"").trim());
      setAiResult(parsed);
      setForm(p=>({...p,date:parsed.date||p.date,distance:parsed.distance||p.distance,timeInput:parsed.time||p.timeInput,type:parsed.type||p.type}));
    } catch {
      setAiResult({error:"이미지에서 정보를 읽지 못했어요. 직접 입력해 주세요."});
    }
    setUploading(false);
  }

  const TS = {background:"#0C0C1A",border:"1px solid #222235",borderRadius:8,color:"#E2DDD5",fontSize:12};
  function iClass(i) { return i==="고강도"?"i-high":i==="중강도"?"i-mid":i==="저강도"?"i-low":"i-rest"; }

  return (
    <div className="app">
      <style>{CSS}</style>

      {/* HEADER */}
      <div className="header">
        <div className="header-inner">
          <div className="logo-row">
            <span className="logo">RUNLAB</span>
            <span className="logo-sub">마라톤 훈련 트래커</span>
          </div>
          <div className="tabs">
            {TABS.map(t=>(
              <button key={t} className={`tab${tab===t?" active":""}`} onClick={()=>setTab(t)}>
                {t==="훈련기록"?"🏃 "+t:t==="목표설정"?"🎯 "+t:t==="기록예측"?"📈 "+t:"🩺 "+t}
              </button>
            ))}
          </div>
          <div className="tab-line"/>
        </div>
      </div>

      {/* ══ 훈련기록 ══ */}
      {tab==="훈련기록" && (
        <div className="body fade">
          <div className="card">
            <div className="slabel or">📷 스마트워치 기록 자동 입력</div>
            <div className={`upload-zone${drag?" drag":""}`}
              onClick={()=>fileRef.current.click()}
              onDragOver={e=>{e.preventDefault();setDrag(true);}}
              onDragLeave={()=>setDrag(false)}
              onDrop={e=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f)analyzeImage(f);}}>
              <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(f)analyzeImage(f);}}/>
              {uploading
                ? <><div className="spinner"/><div style={{fontSize:13,color:"#555568",marginTop:10}}>AI가 이미지를 분석하고 있어요...</div></>
                : <><div className="upload-icon">⌚</div><div className="upload-text"><strong>클릭하거나 이미지를 드래그하세요</strong><br/>갤럭시워치·애플워치·가민·나이키런 등 러닝 스크린샷 → AI 자동 분석</div></>}
            </div>
            {aiResult&&!aiResult.error&&(
              <div className="ai-result">
                <div className="ai-result-title">✨ AI 분석 완료 — 아래 양식에 자동 입력되었어요</div>
                <div className="ai-chips">
                  {aiResult.date&&<div className="ai-chip">날짜<span>{aiResult.date}</span></div>}
                  {aiResult.distance&&<div className="ai-chip">거리<span>{aiResult.distance}km</span></div>}
                  {aiResult.time&&<div className="ai-chip">기록<span>{aiResult.time}</span></div>}
                  {aiResult.type&&<div className="ai-chip">종류<span>{aiResult.type}</span></div>}
                </div>
              </div>
            )}
            {aiResult?.error&&<div style={{background:"#D53A3A10",border:"1px solid #D53A3A30",borderRadius:8,padding:"12px 15px",marginTop:12,fontSize:13,color:"#DD7777"}}>⚠️ {aiResult.error}</div>}
          </div>

          <div className="card">
            <div className="slabel or">✏️ 훈련 기록 입력</div>
            <div className="form-grid">
              <div className="field"><label>날짜</label><input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/></div>
              <div className="field"><label>거리 (km)</label><input type="number" placeholder="예: 10" value={form.distance} onChange={e=>setForm(p=>({...p,distance:e.target.value}))}/></div>
              <div className="field"><label>기록 (mm:ss 또는 h:mm:ss)</label><input type="text" placeholder="예: 52:30 또는 1:52:00" value={form.timeInput} onChange={e=>setForm(p=>({...p,timeInput:e.target.value}))}/></div>
              <div className="field"><label>훈련 종류</label>
                <select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>
                  {TYPES.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <button className="btn" onClick={addLog}>+ 기록 저장하기</button>
          </div>

          <div className="card">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div className="slabel" style={{margin:0}}>📋 훈련 이력</div>
              <span style={{fontSize:12,color:"#383848"}}>{logs.length}개 기록</span>
            </div>
            <div className="log-header">{["날짜","거리","기록","페이스","종류"].map(h=><span key={h}>{h}</span>)}</div>
            <div className="log-scroll">
              {[...logs].reverse().map(l=>{
                const s=parseTime(l.timeInput); const pace=!isNaN(s)&&l.distance>0?s/l.distance:null; const c=TC[l.type]||"#555";
                return (<div key={l.id} className="log-row">
                  <span style={{fontSize:13,color:"#88889A"}}>{l.date.slice(5)}</span>
                  <span style={{fontSize:14,fontWeight:700}}>{l.distance}km</span>
                  <span style={{fontSize:13,color:"#CCCCDD",fontVariantNumeric:"tabular-nums"}}>{l.timeInput}</span>
                  <span style={{fontSize:13,color:"#FF8C44",fontVariantNumeric:"tabular-nums"}}>{pace?formatPace(pace)+"/km":"-"}</span>
                  <span className="badge" style={{background:c+"22",color:c}}>{l.type}</span>
                </div>);
              })}
            </div>
          </div>

          <div className="card">
            <div className="slabel">📊 주간 훈련량 — 종류별</div>
            <ResponsiveContainer width="100%" height={195}>
              <BarChart data={weeklyData} margin={{top:4,right:4,left:-18,bottom:0}}>
                <CartesianGrid stroke="#141428" strokeDasharray="3 3"/>
                <XAxis dataKey="week" tick={{fill:"#555568",fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:"#555568",fontSize:11}} axisLine={false} tickLine={false} unit="km"/>
                <Tooltip contentStyle={TS} formatter={(v,n)=>[v+"km",n]}/>
                <Legend wrapperStyle={{fontSize:12,color:"#555568"}}/>
                {TYPES.filter(t=>t!=="레이스").map(t=><Bar key={t} dataKey={t} stackId="a" fill={TC[t]} radius={t==="회복런"?[4,4,0,0]:[0,0,0,0]}/>)}
                <Bar dataKey="레이스" stackId="a" fill={TC["레이스"]} radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="tip">
            💡 <strong>훈련 종류 안내</strong><br/>
            <strong style={{color:"#3A7BD5"}}>LSD</strong> — 편안한 페이스로 장거리 유산소 기반 강화 (목표 페이스보다 1~1.5분/km 느리게)<br/>
            <strong style={{color:"#D53A3A"}}>인터벌</strong> — 고강도 단거리 반복으로 최대산소섭취량(VO₂max) 향상<br/>
            <strong style={{color:"#3AD57B"}}>템포런</strong> — 목표 페이스보다 5~10초 빠르게 20~40분 지속<br/>
            <strong style={{color:"#3AC8D5"}}>회복런</strong> — 아주 느린 페이스로 근육 회복 및 혈류 촉진
          </div>
        </div>
      )}

      {/* ══ 목표설정 ══ */}
      {tab==="목표설정" && (
        <div className="body fade">
          <div className="card">
            <div className="slabel or">🎯 목표 설정</div>
            <div className="form-grid">
              <div className="field"><label>목표 레이스</label>
                <select value={goalRace} onChange={e=>setGoalRace(e.target.value)}>
                  {Object.keys(DIST).map(r=><option key={r}>{r}</option>)}
                </select>
              </div>
              <div className="field"><label>목표 기록 (h:mm:ss)</label>
                <input type="text" placeholder="예: 3:30:00" value={goalTime} onChange={e=>setGoalTime(e.target.value)}/>
              </div>
              <div className="field" style={{gridColumn:"1/-1"}}><label>목표 대회 날짜</label>
                <input type="date" value={targetDate} onChange={e=>setTargetDate(e.target.value)}/>
              </div>
            </div>
          </div>

          {bestRecord&&goalPace&&(<>
            <div className="dday-row">
              <div className="dday-box"><div className="dday-num" style={{color:"#FF5C00"}}>D-{Math.max(0,Math.floor((new Date(targetDate)-new Date())/86400000))}</div><div style={{fontSize:12,color:"#555568",marginTop:5}}>대회까지</div></div>
              <div className="dday-box"><div className="dday-num" style={{color:"#FFB547"}}>{weeksLeft}주</div><div style={{fontSize:12,color:"#555568",marginTop:5}}>훈련 기간</div></div>
              <div className="dday-box"><div className="dday-num" style={{color:"#3AD57B",fontSize:36}}>{formatPace(goalPace)}</div><div style={{fontSize:12,color:"#555568",marginTop:5}}>목표 페이스/km</div></div>
            </div>

            <div className="card">
              <div className="slabel">⚡ 현재 수준 vs 목표</div>
              <div className="stat-grid">
                <div className="stat-box"><div className="stat-label">현재 예상 기록</div><div className="stat-val" style={{fontSize:22,color:"#CCCCDD"}}>{formatTime(currentForGoal)}</div></div>
                <div className="stat-box"><div className="stat-label">목표 기록</div><div className="stat-val" style={{fontSize:22,color:"#FF5C00"}}>{formatTime(goalSecs)}</div></div>
                <div className="stat-box"><div className="stat-label">{gapSecs>0?"단축 필요":"달성!"}</div><div className="stat-val" style={{fontSize:22,color:gapSecs>0?"#FFB547":"#4CAF82"}}>{gapSecs>0?formatTime(gapSecs):"✓"}</div></div>
              </div>
              <div style={{marginTop:16}}>
                <div className="prog-labels"><span>현재 {formatPace(bestRecord.pace)}/km</span><span>달성률 {progressPct.toFixed(0)}%</span></div>
                <div className="prog-bar"><div className="prog-fill" style={{width:progressPct+"%"}}/></div>
                <div style={{textAlign:"right",fontSize:12,color:"#383848",marginTop:5}}>목표 {formatPace(goalPace)}/km</div>
              </div>
            </div>

            {/* 주간 페이스 조절 로드맵 */}
            <div className="card">
              <div className="slabel bl">📐 주차별 페이스 조절 로드맵</div>
              <div style={{fontSize:13,color:"#555568",marginBottom:14}}>
                현재 페이스({formatPace(bestRecord.pace)}/km) → 목표({formatPace(goalPace)}/km) 단계적 조절 계획
              </div>
              <div className="pace-adjust-table">
                {paceAdjustPlan.map((row,i)=>{
                  const maxVol=80;
                  const barColor = row.isNow?"#FF5C00":"#3A7BD5";
                  return (
                    <div key={i} className={`pace-week-row${row.isNow?" now":""}`}>
                      <div className="pace-week-num">{row.week}</div>
                      <div>
                        <div style={{fontSize:11,color:"#555568",marginBottom:4}}>주간 훈련량 {row.vol}km</div>
                        <div className="pace-week-bar-wrap">
                          <div className="pace-week-bar" style={{width:(row.vol/maxVol*100)+"%",background:barColor}}/>
                        </div>
                      </div>
                      <div className="pace-week-target">{formatPace(row.targetPace)}/km</div>
                    </div>
                  );
                })}
              </div>
              <div style={{fontSize:12,color:"#383848",marginTop:12,textAlign:"right"}}>
                🟧 이번 주 목표 &nbsp; 🟦 이후 단계
              </div>
            </div>

            {/* 주간 훈련 계획 */}
            <div className="card">
              <div className="week-header">
                <div className="slabel" style={{margin:0}}>📅 주간 훈련 계획 ({phase})</div>
                <div className="phase-badge">{weeksLeft}주 남음</div>
              </div>
              <div style={{fontSize:13,color:"#555568",marginBottom:14}}>
                {phase==="빌드업"&&"대회 12주+ 전 — 유산소 기반과 훈련량을 차근차근 쌓는 시기"}
                {phase==="피크"  &&"대회 6~12주 전 — 훈련 강도와 거리를 최고 수준으로 끌어올리세요"}
                {phase==="테이퍼"&&"대회 6주 이내 — 훈련량을 줄이고 몸을 레이스에 맞게 충전하세요"}
              </div>
              <div className="day-plan">
                {dayPlan.map(d=>(
                  <div key={d.day} className="day-row">
                    <div className="day-name">{d.day}</div>
                    <div className="day-icon">{d.icon}</div>
                    <div><div className={`day-type-tag ${iClass(d.intensity)}`}>{d.type}</div><div className="day-desc">{d.label}</div></div>
                    <div className="day-km">{d.km}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="slabel">🧭 훈련 원칙 가이드</div>
              <div className="guide-grid">
                {[
                  ["📈","10% 법칙","주간 훈련량을 매주 10% 이상 늘리지 마세요. 과부하는 부상의 지름길입니다."],
                  ["😴","회복은 훈련이다","수면 7~8시간, 주 2일 이상 휴식. 근육은 쉬는 동안 성장합니다."],
                  ["⚡","80/20 법칙","훈련의 80%는 쉬운 페이스(LSD·회복런), 20%만 고강도(인터벌·템포런)로."],
                  ["🥗","영양 & 수분","장거리 전날 탄수화물 카보로딩. 달리는 중 1시간당 물 500ml + 전해질 보충."],
                  ["🦵","근력 보조 운동","주 2회 스쿼트·런지·코어 운동. 러닝 근육 강화로 부상 예방과 효율 향상."],
                  ["🧘","스트레칭","훈련 후 10~15분 정적 스트레칭. 장경인대·종아리·고관절 집중."],
                ].map(([icon,title,body])=>(
                  <div key={title} className="guide-item">
                    <div className="guide-icon">{icon}</div>
                    <div className="guide-title">{title}</div>
                    <div className="guide-body">{body}</div>
                  </div>
                ))}
              </div>
            </div>
          </>)}
        </div>
      )}

      {/* ══ 기록예측 ══ */}
      {tab==="기록예측" && (
        <div className="body fade">
          {!bestRecord?(
            <div className="card" style={{textAlign:"center",padding:50}}>
              <div style={{fontSize:48,marginBottom:12}}>🏃</div>
              <div style={{color:"#555568",fontSize:14}}>훈련기록 탭에서 기록을 먼저 입력해 주세요.</div>
            </div>
          ):(
            <>
              <div className="card" style={{borderColor:"#FF5C0040"}}>
                <div className="slabel or">기준 최고 기록</div>
                <div className="stat-grid">
                  <div className="stat-box"><div className="stat-label">기준 거리</div><div className="stat-val" style={{color:"#FF5C00"}}>{bestRecord.distance}km</div></div>
                  <div className="stat-box"><div className="stat-label">기록</div><div className="stat-val">{bestRecord.timeInput}</div></div>
                  <div className="stat-box"><div className="stat-label">평균 페이스</div><div className="stat-val" style={{color:"#FF8C44",fontSize:22}}>{formatPace(bestRecord.pace)}/km</div></div>
                </div>
              </div>
              <div className="card">
                <div className="slabel">🏁 거리별 레이스 예상 기록</div>
                <div style={{fontSize:13,color:"#555568",marginBottom:16}}>Riegel 공식(T₂ = T₁ × (D₂/D₁)^1.06) 기반 — 기록이 많아질수록 더 정확해집니다</div>
                <div className="pred-grid">
                  {predictions.map(p=>(
                    <div key={p.name} className="pred-card">
                      <div className="pred-label">{p.name} ({p.dist.toFixed(1)}km)</div>
                      <div className="pred-time">{formatTime(p.secs)}</div>
                      <div className="pred-pace">페이스 {formatPace(p.pace)}/km</div>
                      <div className="pred-comment">{p.comment}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card">
                <div className="slabel">📉 페이스 추이</div>
                <div style={{fontSize:13,color:"#555568",marginBottom:14}}>아래쪽 = 더 빠른 페이스 · 점 색상 = 훈련 종류</div>
                <ResponsiveContainer width="100%" height={195}>
                  <LineChart data={paceTrend} margin={{top:4,right:4,left:-10,bottom:0}}>
                    <CartesianGrid stroke="#141428" strokeDasharray="3 3"/>
                    <XAxis dataKey="date" tick={{fill:"#555568",fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis reversed tick={{fill:"#555568",fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>formatPace(v)} domain={["auto","auto"]}/>
                    <Tooltip contentStyle={TS} formatter={v=>[formatPace(v)+"/km","페이스"]}/>
                    <Line type="monotone" dataKey="pace" stroke="#FF5C00" strokeWidth={2.5}
                      dot={({cx,cy,payload})=><circle key={payload.date+payload.pace} cx={cx} cy={cy} r={5} fill={TC[payload.type]||"#FF5C00"} strokeWidth={0}/>}
                      activeDot={{r:7,fill:"#FF5C00"}}/>
                  </LineChart>
                </ResponsiveContainer>
                <div style={{display:"flex",gap:14,flexWrap:"wrap",marginTop:12}}>
                  {Object.entries(TC).map(([k,c])=>(
                    <div key={k} style={{display:"flex",alignItems:"center",gap:5}}>
                      <div style={{width:9,height:9,borderRadius:"50%",background:c}}/><span style={{fontSize:11,color:"#555568"}}>{k}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card">
                <div className="slabel">🏅 풀마라톤 수준 기준표</div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {[["서브3:00",[0,3*3600],"#FF5C00","엘리트 — 전국 상위 0.1%"],["서브3:30",[3*3600,3*3600+30*60],"#FFB547","실업팀급 — 전국 상위 1%"],["서브4:00",[3*3600+30*60,4*3600],"#3AD57B","상위 5% — 탄탄한 훈련자"],["서브4:30",[4*3600,4*3600+30*60],"#3A7BD5","상위 20% — 꾸준한 러너"],["서브5:00",[4*3600+30*60,5*3600],"#3AC8D5","완주+경쟁 수준"],["5:00이상",[5*3600,Infinity],"#555568","완주 도전 — 시작이 반이에요!"]].map(([label,[lo,hi],color,desc])=>{
                    const my=riegel(bestRecord.time,bestRecord.distance,42.195); const isMe=my>=lo&&my<hi;
                    return (<div key={label} style={{display:"grid",gridTemplateColumns:"90px 90px 1fr",gap:10,background:isMe?"#FF5C0015":"#101020",border:isMe?"1px solid #FF5C0050":"1px solid transparent",borderRadius:8,padding:"11px 14px",alignItems:"center"}}>
                      <div style={{fontFamily:"'Bebas Neue'",fontSize:17,color,letterSpacing:".04em"}}>{label}</div>
                      <div style={{fontSize:11,color:"#555568"}}>{lo===0?"3:00 미만":formatTime(lo)+"~"+(hi===Infinity?"":formatTime(hi))}</div>
                      <div style={{fontSize:12,color:isMe?"#CCCCDD":"#555568"}}>{isMe?"👈 현재 나의 수준  ":""}{desc}</div>
                    </div>);
                  })}
                </div>
              </div>
              <div className="tip-blue">💡 <strong>예측 정확도 높이는 법</strong><br/>Riegel 공식은 훈련된 러너 기준 ±3~5% 오차가 있어요. ① 훈련 기록을 최소 8개 이상 쌓기 ② 5K·10K·하프 레이스 기록도 함께 입력하기 ③ 목표 거리에 가까운 훈련일수록 예측이 더 정확합니다.</div>
            </>
          )}
        </div>
      )}

      {/* ══ 건강관리 ══ */}
      {tab==="건강관리" && (
        <div className="body fade">

          {/* ① 심리 컨디션 체크 */}
          <div className="card">
            <div className="slabel pu">🧠 오늘의 심리 컨디션 체크</div>
            <div style={{fontSize:13,color:"#555568",marginBottom:16}}>이모지를 선택해서 오늘의 상태를 체크하세요 (왼쪽이 낮음, 오른쪽이 높음)</div>
            <div className="mental-grid">
              {MENTAL_CHECKS.map(item=>(
                <div key={item.key} className="mental-row">
                  <div className="mental-label">{item.label}</div>
                  <div className="emoji-row">
                    {item.icons.map((icon,i)=>(
                      <button key={i} className={`emoji-btn${mentalScores[item.key]===i+1?" sel":""}`}
                        onClick={()=>setMentalScores(p=>({...p,[item.key]:i+1}))}>
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {mentalAvg!==null&&(()=>{
              const {msg,color}=getMentalMsg(mentalAvg);
              return (
                <div className="mental-result" style={{marginTop:16}}>
                  <div className="mental-score-row">
                    <div className="mental-score" style={{color}}>{mentalAvg}</div>
                    <div>
                      <div style={{fontSize:11,color:"#555568",marginBottom:4}}>오늘의 컨디션 점수 / 100</div>
                      <div style={{height:6,background:"#1A1A2E",borderRadius:3,overflow:"hidden",width:200}}>
                        <div style={{height:"100%",width:mentalAvg+"%",background:color,borderRadius:3,transition:"width 1s"}}/>
                      </div>
                    </div>
                  </div>
                  <div className="mental-msg" style={{color}}>{msg}</div>
                </div>
              );
            })()}
            <div className="tip-purple" style={{marginTop:16}}>
              💡 <strong>심리가 기록을 만든다</strong><br/>
              레이스 당일 긴장과 자신감은 기록에 직접 영향을 줍니다. 연구에 따르면 과도한 불안은 심박수를 높이고 에너지 소비를 늘려 기록을 3~5% 저하시킵니다. 훈련 중에도 페이스를 "느낀다"는 마음가짐으로 달리는 것이 심박수 기반 훈련만큼 효과적입니다.
            </div>
          </div>

          {/* ② 부상 관리 */}
          <div className="card">
            <div className="slabel" style={{color:"#D53A3A"}}>🩹 부상 부위 체크 & 대처 가이드</div>
            <div style={{fontSize:13,color:"#555568",marginBottom:14}}>불편한 부위를 선택하면 원인과 처치 방법을 알려드립니다</div>
            <div className="injury-grid">
              {INJURY_PARTS.map(p=>(
                <div key={p.id} className={`injury-card${selectedInjury===p.id?" sel":""}`}
                  onClick={()=>setSelectedInjury(selectedInjury===p.id?null:p.id)}>
                  <div className="injury-icon">{p.icon}</div>
                  <div className="injury-name">{p.label}</div>
                  <div className="injury-sub">{p.desc}</div>
                </div>
              ))}
            </div>
            {selectedInjury&&(()=>{
              const p=INJURY_PARTS.find(x=>x.id===selectedInjury);
              return (
                <div className="injury-detail">
                  <div className="injury-detail-title">{p.icon} {p.label} — 처치 가이드</div>
                  <div className="injury-detail-body">{p.treatment}</div>
                </div>
              );
            })()}
            <div style={{marginTop:16}} className="tip" style={{background:"#D53A3A10",border:"1px solid #D53A3A28",borderRadius:9,padding:"15px 17px",fontSize:13,color:"#DD8877",lineHeight:1.75,marginTop:16}}>
              🚨 <strong>부상 신호 절대 무시 금지</strong><br/>
              "조금 아파도 괜찮겠지"는 가장 위험한 생각입니다. 통증이 있을 때 훈련 강행은 2~4주의 부상을 3~6개월 장기 부상으로 키웁니다. 통증 부위가 붓거나 열감이 느껴지면 즉시 훈련을 중단하세요.
            </div>
          </div>

          {/* ③ 체중 관리 */}
          <div className="card">
            <div className="slabel gr">⚖️ 체중 관리 & 기록 영향 분석</div>
            <div style={{fontSize:13,color:"#555568",marginBottom:16}}>체중 1kg 감소 시 페이스가 약 2~3초/km 개선됩니다 (개인차 있음)</div>

            {/* 체중 입력 */}
            <div style={{display:"flex",gap:10,alignItems:"flex-end",marginBottom:14}}>
              <div className="field" style={{flex:1}}>
                <label>날짜</label>
                <input type="date" value={weightForm.date} onChange={e=>setWeightForm(p=>({...p,date:e.target.value}))}/>
              </div>
              <div className="field" style={{flex:1}}>
                <label>체중 (kg)</label>
                <input type="number" step="0.1" placeholder="예: 70.5" value={weightForm.kg} onChange={e=>setWeightForm(p=>({...p,kg:e.target.value}))}/>
              </div>
              <button className="btn" style={{width:"auto",padding:"12px 20px",marginTop:0}} onClick={addWeight}>추가</button>
            </div>

            {/* 체중 추이 차트 */}
            {weightTrend.length>0&&(
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={weightTrend} margin={{top:4,right:4,left:-20,bottom:0}}>
                  <defs>
                    <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3AD57B" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3AD57B" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#141428" strokeDasharray="3 3"/>
                  <XAxis dataKey="date" tick={{fill:"#555568",fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:"#555568",fontSize:11}} axisLine={false} tickLine={false} unit="kg" domain={["auto","auto"]}/>
                  <Tooltip contentStyle={TS} formatter={v=>[v+"kg","체중"]}/>
                  <Area type="monotone" dataKey="kg" stroke="#3AD57B" strokeWidth={2} fill="url(#wg)" dot={{fill:"#3AD57B",r:4}}/>
                </AreaChart>
              </ResponsiveContainer>
            )}

            {/* 최근 체중 목록 */}
            <div className="weight-list">
              {[...weights].reverse().slice(0,5).map((w,i,arr)=>{
                const prev=arr[i+1];
                const diff=prev?w.kg-prev.kg:null;
                return (
                  <div key={w.id} className="weight-row">
                    <span style={{color:"#88889A"}}>{w.date.slice(5)}</span>
                    <span style={{fontWeight:700}}>{w.kg}kg</span>
                    {diff!==null
                      ? <span style={{color:diff<0?"#3AD57B":"#D53A3A",fontWeight:700}}>{diff>0?"+":""}{diff.toFixed(1)}kg</span>
                      : <span style={{color:"#383848"}}>—</span>}
                    {bmi&&i===0&&<span style={{fontSize:12,color:"#FF8C44"}}>BMI {bmi}</span>}
                  </div>
                );
              })}
            </div>

            {/* 목표 체중 영향 */}
            <div style={{marginTop:18}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div style={{fontSize:13,fontWeight:700,color:"#CCCCDD"}}>레이스 목표 체중 설정</div>
              </div>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <div className="field" style={{flex:1}}>
                  <label>키 (cm)</label>
                  <input type="number" value={height} onChange={e=>setHeight(Number(e.target.value))}/>
                </div>
                <div className="field" style={{flex:1}}>
                  <label>목표 레이스 체중 (kg)</label>
                  <input type="number" step="0.5" value={raceWeight} onChange={e=>setRaceWeight(Number(e.target.value))}/>
                </div>
              </div>
            </div>

            {weightImpact&&bestRecord&&(
              <div style={{marginTop:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div className="stat-box">
                  <div className="stat-label">감량 필요</div>
                  <div className="stat-val" style={{color:weightImpact.diff>0?"#FFB547":"#3AD57B",fontSize:26}}>
                    {weightImpact.diff>0?"-"+weightImpact.diff.toFixed(1):"달성!"}kg
                  </div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">예상 페이스 개선</div>
                  <div className="stat-val" style={{color:"#3AD57B",fontSize:22}}>
                    {weightImpact.diff>0?"-"+weightImpact.secPerKm.toFixed(0)+"초/km":"—"}
                  </div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">현재 풀마라톤 예상</div>
                  <div className="stat-val" style={{fontSize:20,color:"#CCCCDD"}}>{formatTime(weightImpact.currentFullTime)}</div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">목표 체중 시 예상</div>
                  <div className="stat-val" style={{fontSize:20,color:"#3AD57B"}}>{formatTime(Math.max(0,weightImpact.newFullTime))}</div>
                </div>
              </div>
            )}

            <div className="tip-green" style={{marginTop:16}}>
              💡 <strong>러너의 체중 관리 원칙</strong><br/>
              무리한 감량은 근손실과 면역력 저하로 훈련 효율을 오히려 떨어뜨립니다. 대회 8주 전부터 주당 0.3~0.5kg 감량을 목표로 하고, 대회 2주 전부터는 체중 감량을 멈추고 탄수화물 보충에 집중하세요. 적정 BMI는 러너 기준 18.5~22 입니다.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
