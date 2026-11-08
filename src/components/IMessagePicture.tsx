import { localizeView } from '../i18n/localizeView';
/** Simple scenes keep the same people, objects and actions across all reading levels. */
const ink = '#3b526d';
const skin = '#ffdec7';
function Person({ x, y = 26, shirt = '#7eb8ec', gesture = 'rest', scale = 1, mood = 'calm' }: { x: number; y?: number; shirt?: string; gesture?: 'rest' | 'ears' | 'point' | 'wave' | 'stop' | 'model'; scale?: number; mood?: 'calm' | 'hurt' | 'speaking' }) {
  return localizeView(<g transform={`translate(${x} ${y}) scale(${scale})`} stroke={ink} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M-17 65 L-19 98 M17 65 L19 98" fill="none" />
    <path d="M-18 40 Q0 31 18 40 L21 73 L-21 73Z" fill={shirt} />
    <circle cy="19" r="22" fill={skin} />
    <path d="M-21 12 Q-18-9 0-5 Q18-9 21 12 Q10 7 5 0 Q-3 11-21 12" fill="#63564f" stroke="none" />
    <circle cx="-7" cy="19" r="1.8" fill={ink} stroke="none"/><circle cx="7" cy="19" r="1.8" fill={ink} stroke="none"/>
    {mood === 'hurt' ? <><path d="M-6 32 Q0 25 6 32 M-12 12 L-5 9 M5 9 L12 12" fill="none" strokeWidth="2.4"/></> : mood === 'speaking' ? <ellipse cy="30" rx="5" ry="4" fill="#fff" strokeWidth="2"/> : <path d="M-5 29 Q0 32 5 29" fill="none"/>}
    {gesture === 'ears' ? <><path d="M-17 44 L-31 31 L-24 19 M17 44 L31 31 L24 19" fill="none"/><circle cx="-24" cy="19" r="5" fill={skin}/><circle cx="24" cy="19" r="5" fill={skin}/></> : gesture === 'point' ? <path d="M17 45 L35 51 L47 37 M-17 45 L-26 66" fill="none"/> : gesture === 'wave' ? <path d="M-17 45 L-26 65 M17 45 L32 34 L32 17" fill="none"/> : gesture === 'stop' ? <><path d="M-17 45 L-26 65 M17 45 L30 42 L37 30" fill="none"/><StopHand x={40} y={20} scale={.52}/></> : gesture === 'model' ? <path d="M-17 45 L-27 68" fill="none"/> : <path d="M-17 45 L-27 68 M17 45 L27 68" fill="none"/>}
  </g>);
}
function Clock({ x = 161, y = 35, size = 23 }: { x?: number; y?: number; size?: number }) {
  return localizeView(<g transform={`translate(${x} ${y})`} stroke={ink} strokeWidth="3" strokeLinecap="round"><circle r={size} fill="#fff8d7"/><path d={`M0 ${-size * .62} V0 L${size * .5} ${size * .2}`} fill="none"/></g>);
}
function StopHand({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return localizeView(<g transform={`translate(${x} ${y}) scale(${scale})`} fill={skin} stroke={ink} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M-11 23 L-23 3 Q-27-3-23-6 Q-19-9-15-3 L-11 3 V-18 Q-11-24-6-24 Q-1-24-1-18 V-24 Q-1-30 4-30 Q9-30 9-24 V-19 Q9-25 14-25 Q19-25 19-19 V-10 Q19-15 23-15 Q27-15 27-10 V12 Q27 29 13 31 H1 Q-6 30-11 23Z"/>
    <path d="M-1-17 V1 M9-17 V1 M19-9 V3 M-6 10 Q3 5 10 9" fill="none" strokeWidth="2"/>
  </g>);
}
/** The words are never written in the picture: shape and expression show how the speech feels. */
function TeasingScene() {
  return localizeView(<>
    <Person x={42} y={39} scale={.88} shirt="#efb58f" gesture="point" mood="speaking"/>
    <Person x={177} y={39} scale={.88} mood="hurt"/>
    <path d="M90 15 H143 Q154 15 154 27 V43 Q154 54 143 54 H111 L88 67 L93 54 H90 Q79 54 79 43 V27 Q79 15 90 15Z" fill="#fff0ea" stroke={ink} strokeWidth="2.8" strokeLinejoin="round"/>
    <path d="M92 34 L104 27 L113 39 L123 28 L141 35" fill="none" stroke="#b77369" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M157 76 Q148 82 155 91 M164 84 Q154 91 161 99" fill="none" stroke="#bb8c90" strokeWidth="2.5" strokeLinecap="round"/>
  </>);
}
function StopTeasing() {
  return localizeView(<>
    <Person x={44} y={40} scale={.86} gesture="stop" mood="speaking"/>
    <Person x={180} y={40} scale={.86} shirt="#efb58f"/>
    <path d="M105 20 H141 Q154 20 154 33 V48 Q154 59 142 59 H122 L105 72 L108 59 H105 Q93 59 93 47 V33 Q93 20 105 20Z" fill="#fff" stroke={ink} strokeWidth="2.8" strokeLinejoin="round"/>
    <path d="M105 37 L115 32 L124 43 L136 34 L144 39" stroke="#aa8c8b" strokeWidth="3" fill="none" strokeLinecap="round"/>
    <path d="M105 56 L142 23" stroke="#ba7471" strokeWidth="4.5" strokeLinecap="round"/>
  </>);
}
function KindWords() {
  return localizeView(<>
    <Person x={43} y={43} scale={.84} gesture="point" mood="speaking"/>
    <Person x={179} y={43} scale={.84} shirt="#efb58f"/>
    <path d="M92 15 H134 Q148 15 148 29 V46 Q148 58 135 58 H112 L91 71 L95 58 H92 Q79 58 79 45 V29 Q79 15 92 15Z" fill="#f4fbf2" stroke={ink} strokeWidth="2.8" strokeLinejoin="round"/>
    <path d="M113 32 C100 17 89 38 113 50 C137 38 127 17 113 32Z" fill="#e5a4b0" stroke="#ac7885" strokeWidth="2"/>
    <path d="M84 83 Q95 89 106 83 M111 83 Q122 89 133 83" stroke="#8aad99" strokeWidth="3" fill="none" strokeLinecap="round"/>
  </>);
}
function ShapeBoard({ x = 107, y = 98, highlight = false }: { x?: number; y?: number; highlight?: boolean }) {
  return localizeView(<g transform={`translate(${x} ${y})`} stroke={ink} strokeWidth="2.8" strokeLinejoin="round">
    <rect width="98" height="42" rx="9" fill="#f4d7a6"/>
    <circle cx="25" cy="21" r="13" fill="#f5f9fc"/>
    <path d="M72 7 L88 34 H56Z" fill="#f5f9fc"/>
    {highlight && <circle cx="25" cy="21" r="19" fill="none" stroke="#5685bd" strokeWidth="3.5"/>}
  </g>);
}
function DifficultActivity() {
  return localizeView(<>
    <Person x={45} y={40} scale={.89} gesture="point" mood="hurt"/>
    <ShapeBoard/>
    <circle cx="179" cy="68" r="16" fill="#83b9df" stroke={ink} strokeWidth="3"/>
    <path d="M179 88 V105 M173 99 L179 105 L185 99" fill="none" stroke="#9b8e8e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 4"/>
    <path d="M110 48 Q110 35 122 35 Q136 35 133 46 Q132 53 122 58 V64" stroke="#7793ae" strokeWidth="4" fill="none" strokeLinecap="round"/><circle cx="122" cy="74" r="2.4" fill="#7793ae"/>
  </>);
}
function RepeatExplanation() {
  return localizeView(<>
    <Person x={39} y={30} scale={.98} shirt="#abcbae" gesture="model" mood="speaking"/>
    <Person x={186} y={19} scale={.67}/>
    <ShapeBoard x={105} y={101} highlight/>
    <path d="M56 74 L88 64 L116 61" stroke={ink} strokeWidth="4" fill="none" strokeLinecap="round"/>
    <path d="M113 57 L129 55 Q136 54 139 59 L134 65 L118 66Z" fill={skin} stroke={ink} strokeWidth="2.5" strokeLinejoin="round"/>
    <circle cx="130" cy="75" r="14" fill="#83b9df" stroke={ink} strokeWidth="3"/>
    <path d="M130 93 V113 M124 107 L130 113 L136 107" fill="none" stroke="#5685bd" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    <g transform="translate(89 31)" fill="none" stroke="#5685bd" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M-16-3 A17 17 0 0 1 15-9 M7-10 L16-8 L17-18 M16 4 A17 17 0 0 1-15 10 M-7 11 L-16 9 L-17 19"/>
    </g>
  </>);
}
/** Both choices are the same matching task; the selected board has only one shape to place. */
function EasierActivity() {
  return localizeView(<>
    <g stroke={ink} strokeWidth="2.5" strokeLinejoin="round">
      <rect x="13" y="21" width="77" height="47" rx="8" fill="#f4d7a6"/>
      <circle cx="30" cy="44" r="9" fill="#f5f9fc"/>
      <path d="M51 32 L61 52 H41Z" fill="#f5f9fc"/>
      <rect x="67" y="35" width="17" height="18" rx="2" fill="#f5f9fc"/>
      <rect x="136" y="21" width="69" height="47" rx="8" fill="#f4d7a6"/>
      <circle cx="170" cy="44" r="14" fill="#f5f9fc"/>
    </g>
    <rect x="131" y="16" width="79" height="57" rx="12" fill="none" stroke="#5685bd" strokeWidth="3.2"/>
    <path d="M101 44 H122 M114 36 L122 44 L114 52" fill="none" stroke="#5685bd" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <Person x={109} y={78} scale={.65} gesture="model"/>
    <path d="M120 107 L143 101 L159 81" fill="none" stroke={ink} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="160" cy="80" r="3.5" fill={skin} stroke={ink} strokeWidth="1.8"/>
  </>);
}
function ActivityBall({ x, y, size = 24 }: { x: number; y: number; size?: number }) {
  return localizeView(<g transform={`translate(${x} ${y}) scale(${size / 24})`} stroke={ink} strokeWidth="2.8" strokeLinecap="round" fill="none">
    <circle r="24" fill="#efbd8c"/>
    <path d="M-24 0 H24 M0-24 V24 M-17-17 Q5 0-17 17 M17-17 Q-5 0 17 17"/>
  </g>);
}
function QuestionMark({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return localizeView(<g transform={`translate(${x} ${y}) scale(${scale})`} fill="none" stroke="#527ead" strokeWidth="3.5" strokeLinecap="round">
    <path d="M-10-10 Q-10-23 2-23 Q15-23 13-12 Q12-6 2-1 V5"/><circle cy="15" cx="2" r="1.8" fill="#527ead"/>
  </g>);
}
function UnavailableActivity() {
  return localizeView(<>
    <Person x={48} y={43} scale={.88} gesture="point"/>
    <ActivityBall x={164} y={91} size={28}/>
    <path d="M117 128 H204" stroke="#9caec0" strokeWidth="3" strokeLinecap="round"/>
    <Clock x={158} y={30} size={20}/>
    <g stroke="#b77872" strokeWidth="3.8" strokeLinecap="round"><circle cx="190" cy="112" r="17" fill="#fff4ec"/><path d="M179 123 L201 101"/></g>
  </>);
}
function AskUnavailableReason() {
  return localizeView(<>
    <Person x={39} y={47} scale={.82} gesture="point" mood="speaking"/>
    <Person x={183} y={47} scale={.82} shirt="#abcbae"/>
    <path d="M87 11 H134 Q147 11 147 24 V56 Q147 68 134 68 H99 L82 81 L86 68 Q74 68 74 56 V24 Q74 11 87 11Z" fill="#fff" stroke={ink} strokeWidth="2.8" strokeLinejoin="round"/>
    <QuestionMark x={108} y={39}/>
    <ActivityBall x={111} y={113} size={19}/>
    <path d="M96 128 L126 98" stroke="#b77872" strokeWidth="4" strokeLinecap="round"/>
  </>);
}
function AskAvailableTime() {
  return localizeView(<>
    <Person x={36} y={47} scale={.82} gesture="point" mood="speaking"/>
    <Person x={184} y={47} scale={.82} shirt="#abcbae"/>
    <path d="M84 12 H137 Q152 12 152 27 V59 Q152 73 137 73 H99 L80 86 L84 73 Q71 73 71 59 V27 Q71 12 84 12Z" fill="#fff" stroke={ink} strokeWidth="2.8" strokeLinejoin="round"/>
    <Clock x={102} y={43} size={20}/>
    <QuestionMark x={132} y={44} scale={.66}/>
    <ActivityBall x={111} y={114} size={20}/>
  </>);
}
function ChooseOtherActivity() {
  return localizeView(<>
    <Person x={39} y={48} scale={.82} gesture="point"/>
    <g stroke={ink} strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="112" y="16" width="87" height="53" rx="9" fill="#fff"/>
      <path d="M128 54 L139 36 L151 49 L161 37 L179 55Z" fill="#abcbae" stroke="#73987c"/>
      <circle cx="174" cy="31" r="6" fill="#f2d58d" stroke="#b59b63"/>
      <rect x="112" y="89" width="87" height="53" rx="9" fill="#fff"/>
      <path d="M151 123 V102 L177 97 V118 M151 106 L177 101" fill="none" stroke="#9183b7"/>
      <ellipse cx="144" cy="125" rx="7" ry="5" fill="#b3a5d5" stroke="#9183b7"/>
      <ellipse cx="170" cy="120" rx="7" ry="5" fill="#b3a5d5" stroke="#9183b7"/>
    </g>
    <path d="M82 79 H96 M96 79 V43 H104 M96 79 V116 H104 M99 39 L104 43 L99 47 M99 112 L104 116 L99 120" fill="none" stroke="#7398bc" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </>);
}
function Beanbag() { return localizeView(<g stroke={ink} strokeWidth="3" strokeLinejoin="round"><path d="M83 86 Q57 67 44 89 Q23 133 56 137 H113 Q144 125 124 104Z" fill="#b5d4c4"/><Person x={88} y={19} scale={.75}/><path d="M62 87 Q70 111 111 112" fill="none"/><path d="M162 114 V69 M162 91 Q138 85 143 70 Q162 73 162 91 M162 79 Q178 59 188 67 Q185 83 162 88" fill="#91bda0"/><path d="M145 113 H179 L174 137 H150Z" fill="#efbc9c"/></g>); }
function RestingWhileWaiting() {
  return localizeView(<g stroke={ink} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <Clock x={178} y={34} size={24}/>
    <path d="M77 77 Q48 58 34 88 Q16 125 49 139 H128 Q156 124 138 103Z" fill="#b5d4c4"/>
    <path d="M62 78 Q78 66 97 77 L107 101 L72 109Z" fill="#7eb8ec"/>
    <path d="M73 105 L100 104 L117 118 L135 122 L130 134 L108 128 L90 118 L78 123Z" fill="#8b9bb8"/>
    <path d="M128 129 L142 132 Q149 136 142 140 H126Z" fill="#fff"/>
    <circle cx="79" cy="51" r="22" fill={skin}/>
    <path d="M58 44 Q61 24 79 27 Q97 25 100 44 Q91 41 87 34 Q75 46 58 44" fill="#63564f" stroke="none"/>
    <path d="M67 52 Q71 57 75 52 M84 52 Q88 57 92 52 M75 63 Q80 66 85 62" fill="none" strokeWidth="2.5"/>
    <path d="M68 82 L78 98 L99 101 M96 83 L103 97" fill="none"/>
    <circle cx="102" cy="101" r="5" fill={skin}/>
    <path d="M166 122 V93 M166 107 Q148 98 151 87 Q168 90 166 107 M166 100 Q181 80 190 90 Q188 102 166 109" fill="#91bda0"/>
    <path d="M151 121 H181 L176 140 H156Z" fill="#efbc9c"/>
  </g>);
}
function Feeling({ kind }: { kind: string }) {
  return localizeView(<g stroke={ink} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><circle cx="110" cy="78" r="55" fill={kind === 'angry' ? '#ffcebd' : '#ffe3ca'} />
    {kind === 'angry' ? <><path d="M78 57 L95 63 M125 63 L142 57"/><circle cx="87" cy="75" r="4" fill={ink}/><circle cx="133" cy="75" r="4" fill={ink}/><path d="M91 107 Q110 90 129 107" fill="none"/></> : kind === 'sad' ? <><path d="M80 59 L95 52 M125 52 L140 59"/><path d="M79 75 Q87 81 95 75 M125 75 Q133 81 141 75 M92 109 Q110 92 128 109" fill="none"/><path d="M144 82 Q154 95 145 101 Q135 95 144 82" fill="#89c5ef" stroke="#6ca0d4"/></> : kind === 'worried' ? <><path d="M79 59 Q91 61 97 49 M123 49 Q130 61 141 59" fill="none"/><circle cx="88" cy="75" r="4" fill={ink}/><circle cx="132" cy="75" r="4" fill={ink}/><path d="M96 106 Q110 97 124 106" fill="none"/><path d="M153 39 Q162 51 154 58 Q145 53 153 39" fill="#91c8eb" stroke="#6ca0d4"/></> : <><path d="M79 57 H95 M123 55 L140 61" fill="none"/><circle cx="88" cy="76" r="4" fill={ink}/><circle cx="132" cy="76" r="4" fill={ink}/><path d="M92 106 L126 96" fill="none"/><path d="M58 75 Q48 85 53 96 M162 78 Q174 88 166 99" fill="none" stroke="#b690a7"/></>}
  </g>);
}
const feelingIds = ['uncomfortable', 'angry', 'sad', 'worried'];
function ActivityScene({ id }: { id: string }) {
  switch (id) {
    case 'custom-situation': return localizeView(<><Person x={52} shirt="#abcbae"/><Person x={164}/><g fill="#fff" stroke={ink} strokeWidth="3"><path d="M79 18 H137 Q147 18 147 29 V46 Q147 56 136 56 H112 L99 68 V56 H79 Q69 56 69 46 V29 Q69 18 79 18Z"/></g><g fill={ink}><circle cx="90" cy="37" r="3"/><circle cx="108" cy="37" r="3"/><circle cx="126" cy="37" r="3"/></g></>);
    case 'custom-request': return localizeView(<><Person x={67} gesture="point"/><g stroke={ink} strokeWidth="3" fill="#fff" strokeLinejoin="round"><path d="M115 25 H183 Q195 25 195 37 V71 Q195 83 183 83 H146 L127 98 V83 H115 Q103 83 103 71 V37 Q103 25 115 25Z"/></g><path d="M124 53 H174 M160 42 L175 53 L160 64" fill="none" stroke="#527ead" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/></>);
    case 'noise': return localizeView(<><Person x={47} shirt="#f2b591"/><Person x={173} gesture="ears"/><g stroke="#cc7968" strokeWidth="4" fill="none" strokeLinecap="round"><path d="M80 37 Q94 45 80 55 M92 28 Q113 45 92 65 M108 22 Q135 45 108 73"/></g></>);
    case 'waiting': return localizeView(<><Person x={48} y={44} scale={.72}/><Person x={109} y={44} scale={.72} shirt="#a9c8aa"/><Person x={170} y={61} scale={.6} shirt="#efbd8c"/><Clock x={167} y={30} size={23}/><path d="M33 129 H176" stroke="#8fa5bc" strokeWidth="4" strokeDasharray="7 7"/></>);
    case 'friend-teasing': return localizeView(<TeasingScene/>);
    case 'activity-difficult': return localizeView(<DifficultActivity/>);
    case 'activity-unavailable': return localizeView(<UnavailableActivity/>);
    case 'unavailable-reason': return localizeView(<AskUnavailableReason/>);
    case 'available-time': return localizeView(<AskAvailableTime/>);
    case 'choose-other-activity': return localizeView(<ChooseOtherActivity/>);
    case 'quieter': return localizeView(<><Person x={65}/><g stroke={ink} strokeWidth="3" strokeLinecap="round"><path d="M66 68 L64 52" stroke={skin} strokeWidth="9"/><path d="M64 65 V50"/><path d="M112 48 Q122 54 112 61" fill="none" stroke="#7da58a"/><path d="M143 43 H180 M171 33 L182 43 L171 54" transform="rotate(90 162 43)" fill="none" stroke="#739b81"/></g></>);
    case 'quiet-place':
    case 'rest': return localizeView(<Beanbag/>);
    case 'time': return localizeView(<><Person x={49} gesture="point"/><Person x={163} shirt="#abcbae"/><Clock x={121} y={39} size={26}/></>);
    case 'rest-while-waiting': return localizeView(<RestingWhileWaiting/>);
    case 'stop-teasing': return localizeView(<StopTeasing/>);
    case 'kind-words': return localizeView(<KindWords/>);
    case 'repeat-explanation': return localizeView(<RepeatExplanation/>);
    case 'easier-activity': return localizeView(<EasierActivity/>);
    default: return null;
  }
}
export default function IMessagePicture({ id, className = '' }: { id: string; className?: string }) {
  return localizeView(<svg className={`imessage-picture ${className}`} viewBox="0 0 220 155" aria-hidden="true" focusable="false">
    {!feelingIds.includes(id) && <rect x="4" y="4" width="212" height="147" rx="22" fill="#f1f7fc"/>}
    {feelingIds.includes(id) ? <Feeling kind={id}/> : <ActivityScene id={id}/>}
  </svg>);
}
