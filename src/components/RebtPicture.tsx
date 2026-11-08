import { localizeView } from '../i18n/localizeView';
import { useId, type ReactNode } from 'react';
import type { Student } from '../types';
import type { RebtVisual } from '../learning/simpleRebt';

type Variant = 'scene' | 'thought' | 'help' | 'action';
type Mood = 'calm' | 'sad' | 'worried' | 'smile' | 'neutral' | 'angry';
const ink = '#39516b';
const blue = '#6dace8';
const gold = '#efbb67';
const purple = '#afa0dc';

/** A person doing something, rather than an abstract icon for a situation. */
function Person({ x, y = 81, scale = 1, color = blue, mood = 'calm', pose = 'rest', facing = 'front', gaze = 'front' }: {
  x: number; y?: number; scale?: number; color?: string; mood?: Mood;
  pose?: 'rest' | 'wave' | 'point' | 'hold' | 'stop' | 'show'; facing?: 'front' | 'away'; gaze?: 'front' | 'left' | 'right';
}) {
  return localizeView(<g transform={`translate(${x} ${y}) scale(${scale})`} stroke={ink} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M-12 68l-4 33M12 68l4 33" fill="none"/>
    <path d="M-17 103h-12M17 103h12" fill="none" strokeWidth="6"/>
    <rect x="-24" y="29" width="48" height="43" rx="16" fill={color}/>
    {pose === 'wave' ? <path d="M-21 39l-14-17-2-20M22 40l11 28" fill="none"/>
      : pose === 'point' ? <path d="M-22 40l-8 24M22 40l25-10 15-4" fill="none"/>
        : pose === 'show' ? <path d="M-22 40l-22-17-38 0M22 40l9 26" fill="none"/>
          : pose === 'hold' ? <path d="M-23 40l-5 15 23 1M23 40l5 15-23 1" fill="none"/>
          : pose === 'stop' ? <path d="M-23 40l-8 17 46 4M23 40l8 17-46 4" fill="none"/>
            : <path d="M-22 40l-9 26M22 40l9 26" fill="none"/>}
    <circle cy="10" r="24" fill="#f8d6bc"/>
    <path d="M-24 9c-1-29 44-35 48-5-14-1-20-8-26-13-5 10-13 15-22 18" fill="#596071" stroke="none"/>
    {facing === 'away' ? <path d="M-21 0c5-20 39-17 42 5v22c-12 9-32 8-41-2z" fill="#596071" stroke="none"/> : <>
      <circle cx={gaze === 'left' ? -11 : gaze === 'right' ? -5 : -8} cy="11" r="2.2" fill={ink} stroke="none"/><circle cx={gaze === 'left' ? 5 : gaze === 'right' ? 11 : 8} cy="11" r="2.2" fill={ink} stroke="none"/>
      {mood === 'angry' ? <><ellipse cx="0" cy="23" rx="5" ry="6" fill={ink} stroke="none"/><path d="M-13-1l7 5M6 4l7-5" fill="none" strokeWidth="2.4"/></> : mood === 'neutral' ? <path d="M-5 22h10" fill="none" strokeWidth="2.4"/> : mood === 'sad' || mood === 'worried' ? <><path d="M-7 23q7-7 14 0" fill="none" strokeWidth="2.4"/><path d="M-13 3l7-3M6 0l7 3" fill="none" strokeWidth="2.4"/></>
        : <path d={mood === 'smile' ? 'M-8 20q8 10 16 0' : 'M-5 22q5 3 10 0'} fill="none" strokeWidth="2.4"/>}
    </>}
  </g>);
}

function Cross({ x, y, size = 10 }: { x: number; y: number; size?: number }) {
  return localizeView(<path d={`M${x-size} ${y-size}l${size*2} ${size*2}m0 ${-size*2}l${-size*2} ${size*2}`} stroke="#ba656b" strokeWidth="5" strokeLinecap="round" fill="none"/>);
}
function Arrow({ x = 145, y = 110, direction = 'right', color = '#527db2' }: {x?: number;y?: number;direction?: 'right'|'left'|'down';color?:string}) {
  return localizeView(<g transform={`translate(${x} ${y}) rotate(${direction === 'left' ? 180 : direction === 'down' ? 90 : 0})`} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><path d="M-16 0h32M6-10l10 10-10 10"/></g>);
}
function Clock({ x, y, r = 26, small = false }: { x: number; y: number; r?: number; small?: boolean }) {
  return localizeView(<g transform={`translate(${x} ${y})`} stroke={ink} strokeWidth="3" strokeLinecap="round"><circle r={r} fill="white"/><path d={`M0 ${-r+3}A${r-3} ${r-3} 0 0 1 ${r-3} 0H0Z`} fill={small ? '#cae4d5' : '#bddcf1'} stroke="none"/><path d={`M0 ${-r*.55}V0l${r*.45} ${r*.2}`} fill="none"/></g>);
}
function Bubble({ x, y, w = 82, h = 56, children, thought = false }: { x: number; y: number; w?: number; h?: number; children: ReactNode; thought?: boolean }) {
  return localizeView(<g transform={`translate(${x} ${y})`}>
    <rect width={w} height={h} rx={thought ? 23 : 14} fill="white" stroke="#809bb7" strokeWidth="3" strokeDasharray={thought ? '5 3' : undefined}/>
    {thought ? <><circle cx="16" cy={h+8} r="4" fill="white" stroke="#809bb7" strokeWidth="2"/><circle cx="10" cy={h+17} r="2.5" fill="#809bb7"/></> : <path d={`M18 ${h-1}l-7 14 24-14`} fill="white" stroke="#809bb7" strokeWidth="3" strokeLinejoin="round"/>}
    {children}
  </g>);
}
function Question({x,y}: {x:number;y:number}) {
  return localizeView(<g transform={`translate(${x} ${y})`} fill="none" stroke="#527db2" strokeWidth="5" strokeLinecap="round"><path d="M-8-8c0-15 24-15 24 0 0 8-12 8-12 18"/><circle cx="4" cy="21" r="2" fill="#527db2" stroke="none"/></g>);
}
function Sheet({ x, y, wrong = false, one = false, scale = 1 }: {x:number;y:number;wrong?:boolean;one?:boolean;scale?:number}) {
  return localizeView(<g transform={`translate(${x} ${y}) scale(${scale})`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <rect width="62" height="74" rx="7" fill="white" stroke="#819bb5"/>
    <path d="M12 17h20M12 34h20M12 51h20" stroke="#a9bbcf"/>
    {one ? <rect x="6" y="7" width="50" height="22" rx="5" fill="none" stroke="#477dc0" strokeWidth="4"/> : wrong ? <Cross x={47} y={34} size={6}/> : null}
  </g>);
}
function Pencil({x,y}: {x:number;y:number}) { return localizeView(<g transform={`translate(${x} ${y}) rotate(30)`} stroke={ink} strokeWidth="2"><rect x="-5" y="-19" width="10" height="30" rx="2" fill="#edc968"/><path d="M-5 11l5 10 5-10" fill="#f5d5b3"/></g>); }
function Ball({ x, y, r = 16 }: { x: number; y: number; r?: number }) {
  return localizeView(<g transform={`translate(${x} ${y})`} fill="none" stroke="#a68043" strokeWidth="2.5"><circle r={r} fill="#f4cd84"/><path d={`M${-r} 0h${r*2}M0 ${-r}v${r*2}M${-r*.7} ${-r*.7}q${r} ${r*.7} 0 ${r*1.4}M${r*.7} ${-r*.7}q${-r} ${r*.7} 0 ${r*1.4}`}/></g>);
}
function Book({ x, y }: { x: number; y: number }) {
  return localizeView(<g transform={`translate(${x} ${y})`} stroke="#527db2" strokeWidth="2.5" strokeLinejoin="round"><path d="M-22-17q11-5 22 0 11-5 22 0v33q-11-5-22 0-11-5-22 0z" fill="#d2e6f7"/><path d="M0-17v33M-16-8h10M6-8h10M-16 0h10M6 0h10" fill="none"/></g>);
}
/** Familiar activities swap positions; neither activity disappears. */
function ActivityOrder({ x, y }: { x: number; y: number }) {
  return localizeView(<g transform={`translate(${x} ${y})`}>
    <rect width="161" height="132" rx="15" fill="white" stroke="#819bb5" strokeWidth="3"/>
    <g opacity=".64"><Book x={37} y={32}/><Arrow x={79} y={32}/><Ball x={125} y={32}/></g>
    <path d="M15 63h131" stroke="#ccdbe9" strokeWidth="2" strokeDasharray="4 5"/>
    <rect x="9" y="74" width="143" height="49" rx="10" fill="#e8f2fa" stroke="#527db2" strokeWidth="2.5"/>
    <Ball x={37} y={99}/><Arrow x={80} y={99}/><Book x={125} y={99}/>
  </g>);
}
function ShapeTray({ x, y, shape = 'square', wrong = false }: { x: number; y: number; shape?: 'square' | 'round'; wrong?: boolean }) {
  const round = shape === 'round';
  return localizeView(<g transform={`translate(${x} ${y})`} stroke={ink} strokeWidth="2.5" strokeLinejoin="round">
    <rect x="-35" y="-21" width="70" height="67" rx="8" fill="white"/>
    <path d="M-35 28h70" fill="none" stroke="#b6c8d8"/>
    {round ? <circle cx="0" cy="-7" r="8" fill="#d5e7f7"/> : <rect x="-8" y="-15" width="16" height="16" rx="2" fill="#f5dfb7"/>}
    {round ? <><circle cx="-16" cy="17" r="9" fill="#8bb9df"/><circle cx="10" cy="17" r="9" fill="#8bb9df"/></> : <><rect x="-26" y="8" width="18" height="18" rx="2" fill="#e9ba70"/><rect x="-3" y="8" width="18" height="18" rx="2" fill="#e9ba70"/></>}
    {wrong ? <><circle cx="24" cy="35" r="9" fill="#8bb9df"/><circle cx="24" cy="35" r="14" fill="none" stroke="#527db2" strokeDasharray="4 3"/></> : round ? <circle cx="24" cy="35" r="9" fill="#8bb9df"/> : null}
  </g>);
}
function Tower({ x, y, highlight = false }: { x: number; y: number; highlight?: boolean }) {
  return localizeView(<g transform={`translate(${x} ${y})`} stroke={ink} strokeWidth="2.5" strokeLinejoin="round">
    <rect x="-35" y="11" width="70" height="24" rx="3" fill="#9bbbdc"/>
    <rect x="-25" y="-14" width="50" height="25" rx="3" fill="#f2ce8b"/>
    <rect x="-17" y="-38" width="34" height="24" rx="3" fill="#b5cfae" transform="rotate(18 0 -26)"/>
    {highlight && <rect x="-27" y="-51" width="54" height="49" rx="9" fill="none" stroke="#527db2" strokeWidth="3" strokeDasharray="5 4"/>}
  </g>);
}
function Blocks({x,y}: {x:number;y:number}) { return localizeView(<g transform={`translate(${x} ${y})`} stroke={ink} strokeWidth="2.5"><rect x="-16" y="-4" width="25" height="25" rx="4" fill="#ecbc73"/><path d="M1-18l17 0 0 22-22 0 0-17z" fill="#7eb7d8"/><circle cx="6" cy="-7" r="3" fill="white" stroke="none"/></g>); }
function RestChair({x,y}: {x:number;y:number}) { return localizeView(<g transform={`translate(${x} ${y})`} fill="none" stroke="#76987f" strokeWidth="7" strokeLinecap="round"><path d="M-25-35v42h47M-25 7v24M22 7v24"/></g>); }
function Medal({x,y,small=false}: {x:number;y:number;small?:boolean}) { return localizeView(<g transform={`translate(${x} ${y}) scale(${small ? .65 : 1})`} stroke="#aa863e" strokeWidth="2.5"><path d="M-10 5l-5 22 15-7 15 7-5-22" fill="#7faedf"/><circle r="17" fill="#f5d177"/><path d="M0-10l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#fff8dc" stroke="none"/></g>); }

function Teacher({ x = 264, y = 73, pose = 'rest', mood = 'calm' }: { x?: number; y?: number; pose?: 'rest' | 'point' | 'hold' | 'show'; mood?: Mood }) {
  return localizeView(<><Person x={x} y={y} scale={1.05} color={purple} pose={pose} gaze="left" mood={mood}/><rect x={x+2} y={y+40} width="17" height="12" rx="2" fill="white" stroke={ink} strokeWidth="1.5"/></>);
}
function EmotionCard({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return localizeView(<g transform={`translate(${x} ${y}) scale(${scale})`}><rect x="-26" y="-26" width="52" height="56" rx="7" fill="white" stroke="#819bb5" strokeWidth="3"/><circle cy="-1" r="18" fill="#f8d6bc" stroke={ink} strokeWidth="2"/><circle cx="-6" cy="-5" r="2" fill={ink}/><circle cx="6" cy="-5" r="2" fill={ink}/><path d="M-7 7q7-7 14 0" fill="none" stroke={ink} strokeWidth="2.5" strokeLinecap="round"/></g>);
}
function Poster({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return localizeView(<g transform={`translate(${x} ${y}) scale(${scale})`}><rect width="81" height="83" rx="7" fill="white" stroke="#819bb5" strokeWidth="3"/><path d="M7 54l18-25 17 20 12-13 20 26H7z" fill="#accbb2"/><circle cx="61" cy="18" r="9" fill="#f1cd7f"/><path d="M16 71h49" stroke="#9cb2c7" strokeWidth="4" strokeLinecap="round"/></g>);
}
function ListeningEar({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return localizeView(<g transform={`translate(${x} ${y}) scale(${scale})`} fill="none" stroke="#527db2" strokeWidth="3" strokeLinecap="round"><path d="M2 35v7c0 12 16 14 18 1l1-5C41 27 37 2 18 2-1 1-9 17-3 28M6 22C4 10 22 6 24 18c2 11-13 9-12 21"/></g>);
}
function SupportPair() {
  return localizeView(<><Person x={27} y={8} scale={.39}/><Person x={66} y={3} scale={.46} color={purple}/><path d="M38 38l13-6" stroke="#527db2" strokeWidth="3" strokeLinecap="round"/></>);
}

function Repeat({ x, y }: { x: number; y: number }) {
  return localizeView(<g transform={`translate(${x} ${y})`} fill="none" stroke="#527db2" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M-15-3a17 17 0 1 1 2 17M-15-14v13h13"/></g>);
}

/** Each built-in action has a distinct depiction. Free text is never classified into an invented action. */
function ActionScene({ visual, sentence }: { visual: RebtVisual; sentence: string }): ReactNode {
  switch (`${visual}:${sentence}`) {
    case 'wait:얼마나 더 기다려야 하는지 물어볼래.': return localizeView(<>
      <Person x={65} y={86} gaze="right" pose="point"/><Teacher/>
      <Bubble x={102} y={12} w={115} h={73}><Clock x={34} y={35} r={24}/><Question x={81} y={30}/></Bubble>
      <Clock x={160} y={147} r={24} small/>
    </>);
    case 'wait:기다리는 동안 다른 활동을 하고 싶다고 말할래.': return localizeView(<>
      <Person x={61} y={87} gaze="right" pose="point"/><Teacher/>
      <Bubble x={94} y={9} w={135} h={72}><Book x={35} y={35}/><Ball x={94} y={35}/></Bubble>
      <Clock x={154} y={135} r={20} small/><path d="M133 170h42" stroke="#b5c8dc" strokeWidth="4" strokeDasharray="6 5"/>
    </>);
    case 'change:바뀐 순서를 확인할래.': return localizeView(<>
      <Person x={62} y={87} pose="point" gaze="right"/><ActivityOrder x={138} y={33}/>
      <path d="M84 93l41-7" stroke="#819bb5" strokeWidth="2.5" strokeDasharray="4 5"/>
    </>);
    case 'change:다음에 무엇을 하는지 물어볼래.': return localizeView(<>
      <Person x={58} y={87} pose="point" gaze="right"/><Teacher/>
      <Bubble x={93} y={10} w={138} h={72}><Book x={29} y={36}/><Arrow x={72} y={35}/><Question x={111} y={29}/></Bubble>
      <g transform="translate(115 112) scale(.55)"><ActivityOrder x={0} y={0}/></g>
    </>);
    case 'study:한 번 더 설명해 주세요.':
    case 'study:한 번 더 알려주세요.':
    case 'study:한 번 더 알려 달라고 할래.': return localizeView(<>
      <Person x={53} y={89} gaze="right"/><Teacher x={270} pose="hold"/>
      <rect x="114" y="123" width="99" height="53" rx="10" fill="white" stroke="#819bb5" strokeWidth="3"/>
      <circle cx="144" cy="148" r="15" fill="#e9f2f9" stroke="#527db2" strokeWidth="3" strokeDasharray="4 3"/><rect x="178" y="134" width="24" height="27" rx="3" fill="#fff1d9" stroke="#a68043" strokeWidth="2.5"/>
      <circle cx="252" cy="128" r="12" fill="#8bb9df" stroke={ink} strokeWidth="3"/><path d="M234 127q-35-37-85-11" fill="none" stroke="#527db2" strokeWidth="3.5"/><path d="M150 105l-4 12 13 2" fill="none" stroke="#527db2" strokeWidth="3.5"/>
      <Bubble x={96} y={12} w={93} h={62}><Repeat x={46} y={29}/></Bubble>
    </>);
    case 'study:다시 한번 생각해 볼래요.':
    case 'study:어떻게 할지 다시 생각해 볼래요.': return localizeView(<>
      <Person x={64} y={88} gaze="right" pose="point"/>
      <rect x="146" y="111" width="122" height="66" rx="12" fill="white" stroke="#819bb5" strokeWidth="3"/>
      <circle cx="175" cy="143" r="17" fill="#e9f2f9" stroke="#527db2" strokeWidth="3" strokeDasharray="4 3"/>
      <rect x="216" y="127" width="31" height="31" rx="4" fill="#fff1d9" stroke="#a68043" strokeWidth="3"/>
      <circle cx="183" cy="81" r="12" fill="#8bb9df" stroke={ink} strokeWidth="3"/>
      <Bubble x={90} y={10} w={115} h={55} thought><circle cx="27" cy="28" r="11" fill="#8bb9df" stroke={ink} strokeWidth="2.5"/><g transform="translate(61 28) scale(.7)"><Repeat x={0} y={0}/></g><g transform="translate(93 24) scale(.65)"><Question x={0} y={0}/></g></Bubble>
      <path d="M125 125l20-8" stroke="#819bb5" strokeWidth="2.5" strokeDasharray="4 4"/>
    </>);
    case 'problem:왜 틀렸는지 살펴볼래.': return localizeView(<>
      <Person x={65} y={86} gaze="right" pose="point"/><Sheet x={155} y={84} wrong one/>
      <circle cx="226" cy="112" r="23" fill="#eef6fb" fillOpacity=".75" stroke="#527db2" strokeWidth="4"/><path d="M243 130l20 22" stroke="#527db2" strokeWidth="7" strokeLinecap="round"/>
      <Bubble x={98} y={9} w={92} h={55} thought><Question x={40} y={21}/></Bubble>
    </>);
    case 'problem:선생님, 다시 설명해 주세요.': return localizeView(<>
      <Person x={54} y={88} gaze="right"/><Teacher x={270} pose="show"/><Sheet x={140} y={104} one/>
      <Bubble x={97} y={9} w={95} h={64}><ListeningEar x={26} y={8} scale={.85}/><g transform="translate(73 31) scale(.57)"><Repeat x={0} y={0}/></g></Bubble>
    </>);
    case 'study:조금 더 쉬운 걸로 해볼래요.':
    case 'study:조금 더 쉬운 것으로 해 보고 싶다고 말할래.': return localizeView(<>
      <Person x={57} y={89} gaze="right" pose="point"/><Teacher/>
      <Bubble x={94} y={10} w={140} h={73}><rect x="14" y="20" width="19" height="19" rx="2" fill="#f2ce8b" stroke={ink} strokeWidth="2"/><circle cx="50" cy="29" r="10" fill="#8bb9df" stroke={ink} strokeWidth="2"/><path d="M18 57l9-14 9 14z" fill="#b4cfae" stroke={ink} strokeWidth="2"/><Arrow x={84} y={36}/><circle cx="118" cy="36" r="12" fill="#8bb9df" stroke={ink} strokeWidth="2"/></Bubble>
      <rect x="130" y="121" width="66" height="56" rx="11" fill="white" stroke="#819bb5" strokeWidth="3"/><circle cx="163" cy="149" r="17" fill="#e9f2f9" stroke="#527db2" strokeWidth="3"/>
    </>);
    case 'sort:넣을 상자를 확인하고 옮겨 볼래.': return localizeView(<>
      <Person x={53} y={86} pose="point" gaze="right"/><ShapeTray x={166} y={130}/><ShapeTray x={265} y={130} shape="round"/>
      <circle cx="192" cy="70" r="13" fill="#8bb9df" stroke={ink} strokeWidth="3"/><path d="M177 69l-39 21-27 23" fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round"/><path d="M211 70q37-1 49 27m-11-4 12 7 3-14" fill="none" stroke="#527db2" strokeWidth="3.5" strokeLinecap="round"/>
    </>);
    case 'sort:어디에 넣는지 선생님께 물어볼래.': return localizeView(<>
      <Person x={51} y={90} pose="point" gaze="right"/><Teacher x={274}/>
      <g transform="translate(96 115) scale(.7)"><ShapeTray x={38} y={30} wrong/><ShapeTray x={139} y={30} shape="round"/></g>
      <Bubble x={91} y={10} w={122} h={73}><circle cx="31" cy="34" r="13" fill="#8bb9df" stroke={ink} strokeWidth="2.5"/><Arrow x={67} y={34}/><Question x={97} y={26}/></Bubble>
    </>);
    case 'feedback:어느 부분인지 물어볼래.': return localizeView(<>
      <Person x={51} y={88} pose="point" gaze="right"/><Teacher/>
      <Tower x={164} y={146} highlight/><path d="M236 120l-28-12-20 7" stroke={ink} strokeWidth="4" strokeLinecap="round" fill="none"/>
      <Bubble x={89} y={10} w={91} h={60}><Question x={38} y={25}/></Bubble>
    </>);
    case 'feedback:다시 하는 방법을 보여 달라고 할래.': return localizeView(<>
      <Person x={52} y={89} gaze="right"/><Teacher x={271} pose="show"/>
      <rect x="127" y="150" width="70" height="24" rx="3" fill="#9bbbdc" stroke={ink} strokeWidth="2.5"/><rect x="137" y="125" width="50" height="25" rx="3" fill="#f2ce8b" stroke={ink} strokeWidth="2.5"/>
      <rect x="165" y="82" width="34" height="24" rx="3" fill="#b5cfae" stroke={ink} strokeWidth="2.5"/>
      <g transform="translate(164 109) scale(.65)"><Arrow x={0} y={0} direction="down"/></g><Bubble x={89} y={8} w={84} h={58}><Repeat x={41} y={28}/></Bubble>
    </>);
    case 'game:아쉬운 마음을 말이나 그림으로 표현할래.': return localizeView(<>
      <Person x={68} y={84} pose="hold" mood="sad"/><EmotionCard x={76} y={142} scale={.82}/>
      <Person x={260} y={87} color={gold}/><Medal x={260} y={49} small/>
      <Bubble x={111} y={21} w={89} h={65}><EmotionCard x={44} y={32} scale={.7}/></Bubble>
      <rect x="135" y="131" width="55" height="40" rx="6" fill="#d8e9dc" stroke="#789985" strokeWidth="2.5"/><circle cx="149" cy="144" r="6" fill={blue}/><circle cx="177" cy="159" r="6" fill={gold}/>
    </>);
    case 'game:이긴 친구에게 축하한다고 말할래.': return localizeView(<>
      <Person x={67} y={84} pose="wave"/><Person x={260} y={87} color={gold}/><Medal x={260} y={49} small/>
      <Bubble x={105} y={16} w={105} h={67}><Medal x={50} y={29} small/><path d="M22 13l5 7M79 13l-5 7M15 33h9M83 33h9" stroke="#a68043" strokeWidth="3" strokeLinecap="round"/></Bubble>
      <rect x="130" y="131" width="61" height="41" rx="6" fill="#d8e9dc" stroke="#789985" strokeWidth="2.5"/><circle cx="145" cy="145" r="6" fill={blue}/><circle cx="177" cy="159" r="6" fill={gold}/>
    </>);
    case 'play-choice:친구가 하고 싶은 놀이를 물어볼래.': return localizeView(<>
      <Person x={62} y={87} pose="point" gaze="right"/><Person x={257} y={87} color={gold} pose="hold" gaze="left"/><Blocks x={257} y={140}/>
      <Bubble x={91} y={10} w={128} h={71}><Ball x={28} y={35}/><Blocks x={66} y={37}/><g transform="translate(106 31) scale(.73)"><Question x={0} y={0}/></g></Bubble>
    </>);
    case 'play-choice:내가 하고 싶은 놀이를 말이나 그림으로 알려 줄래.': return localizeView(<>
      <Person x={69} y={88} pose="hold" gaze="right"/><Person x={259} y={86} color={gold} gaze="left"/>
      <rect x="72" y="120" width="52" height="55" rx="7" fill="white" stroke="#819bb5" strokeWidth="3"/><Ball x={98} y={147}/>
      <Bubble x={113} y={14} w={91} h={69}><Ball x={46} y={34} r={22}/></Bubble>
      <Arrow x={165} y={141}/>
    </>);
    case 'greeting:나중에 다시 인사해 볼래.': return localizeView(<>
      <Person x={73} y={85} pose="wave"/><Person x={252} y={85} color={gold} facing="away"/>
      <Clock x={162} y={54} r={29} small/><Repeat x={161} y={133}/>
    </>);
    case 'greeting:내 마음을 선생님께 말이나 그림으로 전할래.': return localizeView(<>
      <Person x={64} y={87} pose="hold"/><EmotionCard x={75} y={144} scale={.83}/><Teacher x={262}/>
      <Bubble x={110} y={14} w={89} h={67}><EmotionCard x={45} y={34} scale={.73}/></Bubble><Arrow x={166} y={139}/>
    </>);
    case 'presentation:준비한 말을 천천히 이어서 할래.': return localizeView(<>
      <Person x={59} y={87} pose="point" gaze="right"/><Poster x={114} y={90} scale={.9}/>
      <Person x={268} y={111} scale={.7} color={gold} gaze="left"/>
      <Bubble x={95} y={8} w={142} h={66}><Clock x={30} y={32} r={20} small/><circle cx="71" cy="34" r="4" fill="#527db2"/><circle cx="95" cy="34" r="4" fill="#527db2"/><circle cx="119" cy="34" r="4" fill="#527db2"/></Bubble>
      <path d="M85 96q9-5 15 0m-12-11q13-7 23 0" fill="none" stroke="#819bb5" strokeWidth="2.5" strokeLinecap="round"/>
    </>);
    case 'presentation:시선이 부담되면 선생님께 말이나 그림으로 알릴래.': return localizeView(<>
      <Person x={63} y={86} pose="hold" mood="worried"/><EmotionCard x={78} y={144} scale={.8}/><Teacher x={264}/>
      <Bubble x={107} y={8} w={91} h={67}><EmotionCard x={45} y={34} scale={.73}/></Bubble>
      <Poster x={138} y={118} scale={.67}/><path d="M219 106l-20 8" stroke="#819bb5" strokeWidth="3" strokeDasharray="4 5"/>
    </>);
    default: return null;
  }
}

function OpenHand({ x = 0, y = 0, scale = 1 }: { x?: number; y?: number; scale?: number }) {
  return localizeView(<g transform={`translate(${x} ${y}) scale(${scale})`} fill="#f8d6bc" stroke={ink} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M-14 16l-8-15q-3-7 3-8l8 10v-25q0-7 6-7v25-32q0-7 6-5v36-32q0-7 6-5v37-24q0-7 6-5v36q0 15-12 20h-4q-9-2-11-11z"/></g>);
}
function NameTag({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return localizeView(<g transform={`translate(${x} ${y}) scale(${scale})`} stroke={ink} strokeWidth="2.5"><rect x="-29" y="-19" width="58" height="38" rx="7" fill="white"/><circle cx="-15" cy="-4" r="5" fill="#f8d6bc"/><path d="M-21 8q6-9 12 0M-1-6h20M-1 5h13" stroke="#819bb5" strokeWidth="3" strokeLinecap="round" fill="none"/></g>);
}
function HeadIcon({ x, y }: { x: number; y: number }) {
  return localizeView(<g transform={`translate(${x} ${y})`}><circle r="18" fill="#f8d6bc" stroke={ink} strokeWidth="2.5"/><path d="M-18-4q2-23 28-14l8 14q-16-2-23-10z" fill="#596071"/><circle cx="-6" cy="2" r="2" fill={ink}/><circle cx="6" cy="2" r="2" fill={ink}/><path d="M-5 11h10" stroke={ink} strokeWidth="2" strokeLinecap="round"/></g>);
}
function SmallStar({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return localizeView(<path transform={`translate(${x} ${y}) scale(${scale})`} d="M0-19l6 12 14 2-10 10 2 14-12-7-12 7 2-14-10-10 14-2z" fill="#f3d285" stroke="#ad8c49" strokeWidth="2.5" strokeLinejoin="round"/>);
}
function WorkBlocks({ x, y, finished = false }: { x: number; y: number; finished?: boolean }) {
  return localizeView(<g transform={`translate(${x} ${y})`} stroke={ink} strokeWidth="2.5"><rect x="-36" y="19" width="72" height="21" rx="3" fill="#9bbddd"/><rect x="-26" y="-5" width="52" height="24" rx="3" fill="#f0ca86"/>{finished ? <><rect x="-18" y="-27" width="36" height="22" rx="3" fill="#b5cfae"/><path d="M-18-28L0-49l18 21z" fill="#b6a3db"/></> : <rect x="42" y="19" width="23" height="21" rx="3" fill="#b5cfae"/>}</g>);
}
function Cup({ x, y, tipped = false, scale = 1 }: { x: number; y: number; tipped?: boolean; scale?: number }) {
  return localizeView(<g transform={`translate(${x} ${y}) rotate(${tipped ? 62 : 0}) scale(${scale})`} stroke={ink} strokeWidth="2.5"><path d="M-15-17h29v29q-13 13-29 0z" fill="white"/><path d="M15-11h8q13 9 0 18h-8" fill="none"/><ellipse cx="0" cy="-16" rx="13" ry="4" fill="#b19373"/></g>);
}
function FoodTray({ x, y, tipped = false }: { x: number; y: number; tipped?: boolean }) {
  return localizeView(<g transform={`translate(${x} ${y}) rotate(${tipped ? 28 : 0})`} stroke="#6e8498" strokeWidth="2.5"><rect x="-48" y="-23" width="96" height="47" rx="10" fill="#dde6ee"/><path d="M9-18v38M-42-1H6M27-18v16M12 2h30" fill="none"/><ellipse cx="-22" cy="-12" rx="15" ry="8" fill="#fffdf2"/><ellipse cx="-22" cy="11" rx="14" ry="7" fill="#d9af7e"/><circle cx="20" cy="-9" r="5" fill="#adc694"/><circle cx="35" cy="-9" r="5" fill="#eaa887"/><path d="M18 12h18" stroke="#92b680" strokeWidth="6" strokeLinecap="round"/></g>);
}
function PracticeCounter({ x, y, spill = true }: { x: number; y: number; spill?: boolean }) {
  return localizeView(<g transform={`translate(${x} ${y})`}><rect x="-55" y="-61" width="85" height="66" rx="9" fill="#a9becf" stroke={ink} strokeWidth="3"/><rect x="-44" y="-50" width="60" height="19" rx="4" fill="#ecf4fa" stroke={ink} strokeWidth="2"/><path d="M-15-25v20M-42 6h58" stroke={ink} strokeWidth="5" strokeLinecap="round"/><Cup x={-12} y={18} scale={.68}/><path d="M-64 40h157v12H-64z" fill="#dbc7a8" stroke={ink} strokeWidth="3"/><path d="M-54 53v23M83 53v23" stroke={ink} strokeWidth="4"/>{spill ? <><Cup x={61} y={22} tipped scale={.65}/><path d="M78 35q27 10 10 25m-5-2q-15 4-7 11 24 9 27-1-4-9-20-10" fill="#b89c7f" stroke="#987c60" strokeWidth="2"/></> : <Cup x={60} y={18} scale={.72}/>}</g>);
}
function Doorway({ x, y }: { x: number; y: number }) {
  return localizeView(<g transform={`translate(${x} ${y})`} stroke={ink} strokeWidth="3"><path d="M-58 112V5L0-22 61 5v107" fill="#e4edf6"/><rect x="-23" y="39" width="48" height="73" rx="4" fill="#b9cedf"/><circle cx="16" cy="78" r="3" fill={ink}/><rect x="-24" y="0" width="49" height="30" rx="7" fill="white"/><Cup x={-3} y={17} scale={.5}/><rect x="-48" y="44" width="15" height="29" rx="2" fill="white"/><rect x="36" y="44" width="15" height="29" rx="2" fill="white"/></g>);
}
function TellTeacher({ children, teacherMood = 'calm' }: { children: ReactNode; teacherMood?: Mood }) {
  return localizeView(<><Person x={58} y={87} pose="hold" mood="worried" gaze="right"/><EmotionCard x={70} y={144} scale={.78}/><Teacher x={265} mood={teacherMood}/><Bubble x={103} y={13} w={117} h={72}>{children}</Bubble><Arrow x={165} y={138}/></>);
}

/** Concrete, context-specific scenes for the expanded school and practice library. */
function ExpandedScene({ visual, variant, sentence, flexible }: { visual: RebtVisual; variant: Variant; sentence: string; flexible?: boolean }): ReactNode {
  const hardThought = variant === 'thought' && flexible !== true;
  const helping = variant === 'help' || variant === 'action' || (variant === 'thought' && flexible === true);
  const askTeacher = variant === 'action' && /선생님|어른|도움/.test(sentence);
  const mood: Mood = hardThought ? 'worried' : 'calm';
  switch (visual) {
    case 'friend-mistake': {
      if (askTeacher) return localizeView(<TellTeacher teacherMood="neutral"><Person x={40} y={11} scale={.42} mood="worried"/><Person x={69} y={11} scale={.42} color={gold} mood="worried"/><path d="M49 10l4-5m6 4 4-4" stroke="#819bb5" strokeWidth="2" strokeLinecap="round"/></TellTeacher>);
      if (variant === 'help' || variant === 'action') return localizeView(<>
        <g transform="rotate(5 74 144)"><Person x={74} y={87} pose="hold" gaze="right" mood="neutral"/></g>
        <Person x={251} y={87} color={gold} mood="worried" gaze="left" pose="hold"/><Book x={251} y={145}/>
        <Bubble x={108} y={10} w={110} h={72}><EmotionCard x={32} y={34} scale={.65}/><Question x={79} y={28}/></Bubble>
        <path d="M119 139h49m-9-7 9 7-9 7" stroke="#527db2" strokeWidth="3" strokeLinecap="round" fill="none"/>
      </>);
      return localizeView(<>
        <g transform="rotate(4 130 155)"><Person x={130} y={88} scale={.93} mood="worried" gaze="right"/></g>
        <g transform="rotate(-4 184 155)"><Person x={184} y={88} scale={.93} color={gold} mood="worried" gaze="left" pose="hold"/></g>
        <Book x={193} y={139}/><path d="M58 160h35m-9-7 9 7-9 7M267 164h-31m8-7-8 7 8 7" fill="none" stroke="#a3b8cb" strokeWidth="3" strokeLinecap="round" strokeDasharray="5 4"/>
        <path d="M156 101v-10m-6 11-5-7m17 6 5-7" stroke="#8a9caf" strokeWidth="2.5" strokeLinecap="round"/>
        {hardThought ? <Bubble x={48} y={8} w={111} h={56} thought><Person x={30} y={5} scale={.38} mood="worried"/><Question x={78} y={23}/></Bubble> : variant === 'thought' ? <Bubble x={67} y={8} w={80} h={54} thought><EmotionCard x={40} y={26} scale={.67}/></Bubble> : null}
      </>);
    }
    case 'teacher-mistake': {
      const sharingFeeling = variant === 'action' && sentence === '선생님, 제 마음도 말씀드리고 싶어요.';
      const repair = variant === 'help' || variant === 'action';
      return localizeView(<>
        <g transform={repair && !sharingFeeling ? 'rotate(5 68 146)' : undefined}><Person x={68} y={88} mood={repair ? 'neutral' : 'angry'} gaze="right" pose={repair ? 'hold' : 'point'}/></g>
        <Teacher x={265} mood="neutral"/>
        {repair ? <>
          {(sharingFeeling || variant === 'help') && <EmotionCard x={84} y={143} scale={.78}/>}
          <Bubble x={109} y={11} w={107} h={71}>{sharingFeeling ? <EmotionCard x={53} y={35} scale={.8}/> : <><path d="M20 26h61m-61 17h39" stroke="#819bb5" strokeWidth="3" strokeLinecap="round"/><path d="M19 58q11 6 24 0" stroke="#a7bacd" strokeWidth="2" fill="none"/></>}</Bubble>
          <path d="M128 135h58m-9-7 9 7-9 7" fill="none" stroke="#527db2" strokeWidth="3" strokeLinecap="round"/>
        </> : <>
          <Bubble x={117} y={18} w={108} h={66}><path d="M17 21h70m-70 16h70m-70 16h45" stroke="#768da6" strokeWidth="6" strokeLinecap="round"/></Bubble>
          <path d="M93 91q12-7 21-1m-21 7q9-5 15-1" stroke="#8ba0b7" strokeWidth="3" fill="none" strokeLinecap="round"/>
          {hardThought && <Bubble x={15} y={4} w={77} h={49} thought><Person x={24} y={7} scale={.3} mood="worried"/><g transform="translate(55 19) scale(.65)"><Question x={0} y={0}/></g></Bubble>}
        </>}
      </>);
    }
    case 'friend-other': return localizeView(<>
      <Person x={57} y={86} mood={hardThought ? 'sad' : 'calm'} gaze="right" pose={variant === 'help' || variant === 'action' ? 'wave' : 'rest'}/><path d="M21 152h83M31 152v34m63-34v34" stroke="#acbdca" strokeWidth="5" fill="none"/>
      <Person x={203} y={91} color={gold} scale={.9} pose="wave" gaze="right"/><Person x={274} y={97} color={purple} scale={.85} gaze="left"/>
      <Ball x={239} y={164}/><path d="M180 56h64m-10-7 10 7-10 7" stroke="#819bb5" strokeWidth="3" fill="none"/>
      {helping ? <Bubble x={25} y={8} w={111} h={53} thought={variant !== 'action'}><Person x={23} y={4} scale={.35}/><Person x={58} y={4} scale={.35} color={gold}/><Person x={91} y={4} scale={.35} color={purple}/></Bubble> : hardThought ? <Bubble x={23} y={8} w={91} h={52} thought><Person x={27} y={5} scale={.35}/><Person x={65} y={5} scale={.35} color={gold}/><path d="M45 10v32" stroke="#819bb5" strokeWidth="2.5" strokeDasharray="4 3"/></Bubble> : null}
      {(variant === 'help' || variant === 'action') && <path d="M112 164h50m-8-7 8 7-8 7" fill="none" stroke="#819bb5" strokeWidth="3" strokeLinecap="round" strokeDasharray="5 4"/>}
    </>);
    case 'friend-refusal': return askTeacher ? localizeView(<TellTeacher><Book x={34} y={34}/><Question x={87} y={26}/></TellTeacher>) : localizeView(<>
      <Person x={64} y={85} pose="point" mood={mood}/><Person x={258} y={85} color={gold} pose="hold" gaze="left"/><Book x={256} y={143}/>
      <Bubble x={94} y={10} w={95} h={59} thought={hardThought}><Book x={31} y={30}/><g transform="translate(70 26) scale(.65)"><Question x={0} y={0}/></g></Bubble>
      <OpenHand x={219} y={113} scale={.7}/>{helping && <><ListeningEar x={145} y={118} scale={.85}/><path d="M107 172q47 17 93 0" fill="none" stroke="#819bb5" strokeWidth={3} strokeDasharray="5 4"/></>}
    </>);
    case 'friend-conflict': return askTeacher ? localizeView(<TellTeacher><Person x={30} y={9} scale={.42}/><Person x={87} y={9} scale={.42} color={gold}/><path d="M50 22l9-6 6 12 10-5" stroke="#819bb5" strokeWidth="3" fill="none"/></TellTeacher>) : localizeView(<>
      <Person x={71} y={87} mood={helping ? 'neutral' : 'worried'} pose={helping ? 'rest' : 'point'} gaze="right"/><g transform="translate(320 0) scale(-1 1)"><Person x={64} y={87} mood={helping ? 'neutral' : 'worried'} color={gold} pose={helping ? 'rest' : 'point'}/></g>
      {helping ? <><Bubble x={95} y={8} w={68} h={48}><circle cx={21} cy={24} r={4} fill="#527db2"/><circle cx={43} cy={24} r={4} fill="#527db2"/></Bubble><Bubble x={189} y={18} w={67} h={48}><ListeningEar x={25} y={4} scale={.65}/></Bubble><path d="M138 144h51m-9-8 9 8-9 8" stroke="#527db2" strokeWidth="3.5" fill="none"/></> : <><Bubble x={104} y={12} w={109} h={58} thought={hardThought}><path d="M17 27l18-10 12 18 15-16 19 15 13-9" stroke="#9b7a74" strokeWidth="4" fill="none"/></Bubble><path d="M144 104l14 15-12 15 19 9 14-16" stroke="#a4b5c4" strokeWidth="3" fill="none"/></>}
    </>);
    case 'presentation-anxiety': return askTeacher ? localizeView(<TellTeacher><Poster x={16} y={11} scale={.55}/><Question x={87} y={26}/></TellTeacher>) : localizeView(<>
      <Person x={62} y={86} pose="hold" mood={helping ? 'calm' : 'worried'}/><Sheet x={47} y={127} scale={.62}/>
      <Poster x={181} y={62} scale={1.03}/><path d="M188 156h100M203 157v29M277 157v29" stroke="#a8bacb" strokeWidth="5"/>
      <path d="M121 173h37m-9-8 9 8-9 8" stroke="#819bb5" strokeWidth="4" fill="none"/>
      <Bubble x={99} y={9} w={86} h={63} thought={variant !== 'action'}>{helping ? <><Clock x={29} y={31} r={19} small/><Person x={66} y={13} scale={.35} color={purple}/></> : <Question x={36} y={26}/>}</Bubble>
    </>);
    case 'slow-finish': return askTeacher ? localizeView(<TellTeacher><Clock x={34} y={35} r={24} small/><Blocks x={85} y={39}/></TellTeacher>) : localizeView(<>
      <Person x={53} y={91} scale={.9} pose="point" mood={mood}/><Person x={269} y={91} scale={.9} color={gold} pose="hold"/>
      <g transform="translate(81 145) scale(.67)"><WorkBlocks x={0} y={0} finished/></g><g transform="translate(240 140) scale(.65)"><WorkBlocks x={0} y={0} finished/></g><path d="M293 126h13v43h-18v-35" fill="#d9e5ee" stroke={ink} strokeWidth={2.5}/>
      <Clock x={151} y={49} r={27} small={helping}/>{helping ? <path d="M107 113q20-15 35 3m-3-11 1 13-14 0" fill="none" stroke="#527db2" strokeWidth="3.5"/> : hardThought ? <Bubble x={172} y={9} w={70} h={54} thought><g transform="translate(31 29) scale(.4)"><WorkBlocks x={0} y={0} finished/></g></Bubble> : null}
    </>);
    case 'meal-spill': return localizeView(<>
      <Person x={55} y={87} pose="hold" mood={helping ? 'calm' : 'worried'}/><FoodTray x={119} y={136} tipped/>
      <path d="M138 165q30-7 43 5-1 9-37 9-18-3-6-14" fill="#dcc5a9"/><circle cx={167} cy={167} r={6} fill="#adc694"/><circle cx={190} cy={174} r={5} fill="#e5a884"/><path d="M183 154l5-6M159 147l-2-9" stroke="#819bb5" strokeWidth="3"/>
      {helping ? <><Teacher x={272}/><Bubble x={114} y={8} w={108} h={65}><path d="M20 39l18-22 19 22-19 10z" fill="#dbe9f5" stroke={ink} strokeWidth="2.5"/><path d="M69 19v26m-9-11h18" stroke="#527db2" strokeWidth="3.5"/></Bubble></> : <><path d="M224 139h73m-63 0v47m53-47v47" stroke="#9fb4c5" strokeWidth="5"/><FoodTray x={261} y={116}/>{hardThought && <Bubble x={81} y={9} w={81} h={61} thought><Question x={34} y={26}/></Bubble>}</>}
    </>);
    case 'practice-mistake': return localizeView(<>
      <Person x={52} y={87} mood={mood} pose="point"/><path d="M34 121h36v36H34z" fill="#d8e5ed" stroke={ink} strokeWidth="2"/><PracticeCounter x={158} y={108}/>
      {helping ? <><g transform="translate(249 66) scale(.83)"><Teacher x={28} y={7}/></g><Bubble x={94} y={9} w={112} h={49}><Cup x={28} y={25} scale={.65}/><g transform="translate(79 24) scale(.6)"><Repeat x={0} y={0}/></g></Bubble></> : hardThought ? <Bubble x={22} y={7} w={77} h={53} thought><Question x={31} y={20}/></Bubble> : null}
    </>);
    case 'denied-activity': return localizeView(<>
      <Person x={58} y={86} mood={mood} pose="point"/>
      <rect x={188} y={64} width={92} height={77} rx={11} fill="#d8e5f0" stroke={ink} strokeWidth={3}/><rect x={199} y={74} width={70} height={54} rx={5} fill="white"/>
      <path d="M225 91l21 11-21 12z" fill="#a1bcd5"/><rect x={224} y={124} width={32} height={28} rx={5} fill="#fff0d0" stroke={ink} strokeWidth={2.5}/><path d="M231 123v-8q9-15 18 0v8" fill="none" stroke={ink} strokeWidth={3}/>
      {helping ? <Bubble x={83} y={8} w={117} h={57} thought={variant !== 'action'}>{variant === 'action' && /다른 활동/.test(sentence) ? <><Book x={29} y={29}/><Ball x={85} y={29}/></> : variant === 'action' && sentence === '지금 하기 어려운 이유를 물어볼래.' ? <><ListeningEar x={23} y={6} scale={.8}/><Question x={81} y={23}/></> : variant === 'help' && sentence === '지금은 어려운 이유가 있을 수 있어. 이유를 듣고, 할 수 있는 때나 방법이 있는지 물어보자.' ? <><ListeningEar x={13} y={9} scale={.65}/><g transform="translate(57 24) scale(.7)"><Question x={0} y={0}/></g><Clock x={95} y={28} r={16} small/></> : <><Clock x={30} y={29} r={20} small/><Question x={83} y={23}/></>}</Bubble> : <Bubble x={87} y={10} w={87} h={59} thought><rect x={18} y={14} width={50} height={31} rx={5} fill="#dbe9f5" stroke={ink} strokeWidth={2}/><path d="M36 21l15 9-15 9z" fill="#527db2"/></Bubble>}
    </>);
    case 'unfair-scolding': return helping ? localizeView(<TellTeacher><Person x={27} y={9} scale={.42}/><Person x={80} y={9} scale={.42} color={gold}/><g transform="translate(57 25) scale(.55)"><Question x={0} y={0}/></g></TellTeacher>) : localizeView(<>
      <Person x={42} y={106} scale={.76} color={gold}/><Person x={134} y={90} scale={.9} mood="worried"/><Teacher x={276} pose="show"/>
      <Bubble x={174} y={10} w={108} h={55}><path d="M18 20h63M18 32h43" stroke="#819bb5" strokeWidth={4} strokeLinecap="round"/></Bubble>
      <path d="M213 91l-38 18m7-10-7 10 14 0" fill="none" stroke="#819bb5" strokeWidth={3}/>{hardThought && <Bubble x={65} y={11} w={62} h={48} thought><Question x={23} y={17}/></Bubble>}
    </>);
    case 'peer-praise': return localizeView(<>
      <Person x={48} y={88} mood={mood} gaze="right" pose={variant === 'help' || variant === 'action' ? 'hold' : 'rest'}/><Teacher x={171} pose="point"/><Person x={276} y={94} scale={.87} color={gold}/>
      <Bubble x={170} y={8} w={102} h={55}><SmallStar x={51} y={27} scale={.85}/></Bubble>
      {helping ? <Bubble x={15} y={5} w={80} h={55} thought={variant !== 'action'}><Person x={28} y={7} scale={.38}/><SmallStar x={60} y={25} scale={.58}/></Bubble> : hardThought ? <Bubble x={18} y={8} w={66} h={48} thought><Question x={25} y={17}/></Bubble> : null}
      {(variant === 'help' || variant === 'action') && <path d="M38 131l-4-6m28 5 4-6m-30 27-6 4m33-3 6 4" stroke="#a68043" strokeWidth="2.5" strokeLinecap="round"/>}
    </>);
    case 'peer-comparison': return localizeView(<>
      <Person x={54} y={87} mood={mood} pose="point" gaze="right"/><Person x={269} y={87} color={gold} pose="hold"/>
      <g transform="translate(97 149) scale(.7)"><WorkBlocks x={0} y={0}/></g><g transform="translate(232 141) scale(.82)"><WorkBlocks x={0} y={0} finished/></g>
      {helping ? <Bubble x={23} y={7} w={113} h={56} thought={variant !== 'action'}><rect x={18} y={29} width={21} height={17} rx={2} fill="#f0ca86" stroke={ink} strokeWidth={2}/><Arrow x={61} y={31}/><rect x={84} y={12} width={19} height={17} rx={2} fill="#b5cfae" stroke={ink} strokeWidth={2}/><rect x={84} y={30} width={19} height={17} rx={2} fill="#f0ca86" stroke={ink} strokeWidth={2}/></Bubble> : hardThought ? <Bubble x={108} y={9} w={81} h={59} thought><SmallStar x={40} y={29}/></Bubble> : null}
      {variant === 'help' && <path d="M224 85q-42-21-80-17m10-7-10 7 11 6" fill="none" stroke="#819bb5" strokeWidth="2.5" strokeDasharray="5 4"/>}
    </>);
    case 'no-award': return localizeView(<>
      <Person x={56} y={85} mood={hardThought ? 'sad' : 'calm'} gaze="right"/>
      <rect x={151} y={161} width={145} height={26} rx={6} fill="#dde7f2" stroke="#96afc6" strokeWidth={2.5}/><Person x={187} y={83} scale={.77} color={gold}/><Person x={262} y={83} scale={.77} color={purple}/><Medal x={188} y={123} small/><Medal x={264} y={123} small/>
      {helping ? <Bubble x={18} y={9} w={86} h={54} thought={variant !== 'action'}><Blocks x={28} y={30}/><g transform="translate(64 26) scale(.65)"><Repeat x={0} y={0}/></g></Bubble> : hardThought ? <Bubble x={87} y={8} w={86} h={55} thought><Medal x={43} y={24} small/></Bubble> : <path d="M165 38h116" stroke="#9eb4c7" strokeWidth={3} strokeDasharray="6 5"/>}
    </>);
    case 'appearance-teasing':
    case 'nickname-teasing': {
      const nickname = visual === 'nickname-teasing';
      const cue = nickname ? localizeView(<NameTag x={57} y={34} scale={1.1}/>) : localizeView(<HeadIcon x={57} y={35}/>);
      // Reporting is a direct option: no preceding confrontation is depicted or required.
      if (askTeacher || (variant === 'help' && /알리|도움|어른|선생님/.test(sentence))) return localizeView(<TellTeacher>{cue}</TellTeacher>);
      return localizeView(<>
        <Person x={67} y={87} mood={helping ? 'calm' : 'worried'} pose="rest" gaze="right"/>
        {nickname ? <NameTag x={70} y={138} scale={.58}/> : <><ellipse cx={135} cy={139} rx={25} ry={34} fill="#dfeaf4" stroke="#91a9c1" strokeWidth={4}/><HeadIcon x={134} y={134}/><path d="M130 173v13h21" stroke="#91a9c1" strokeWidth={4} fill="none"/></>}
        <g transform="translate(320 0) scale(-1 1)"><Person x={62} y={88} color={gold} pose="point"/></g>
        <Bubble x={159} y={9} w={127} h={64}>{nickname ? <NameTag x={47} y={32} scale={.85}/> : <HeadIcon x={44} y={32}/>}<path d="M84 22l10-6 8 13 11-4M84 41l12-4 13 8" stroke="#9c817b" strokeWidth={3} strokeLinecap="round" fill="none"/></Bubble>
        {helping && <OpenHand x={111} y={83} scale={.72}/>}
      </>);
    }
    case 'cancelled-activity': return localizeView(<>
      <Person x={60} y={88} mood={mood} pose="point"/><rect x={177} y={38} width={102} height={117} rx={12} fill="white" stroke="#819bb5" strokeWidth={3}/><path d="M177 64h102M199 29v19M257 29v19" stroke="#819bb5" strokeWidth={4} strokeLinecap="round"/><Ball x={227} y={107} r={27}/><path d="M200 80l55 55M255 80l-55 55" stroke="#9c817b" strokeWidth={5} strokeLinecap="round"/>
      {helping ? <Bubble x={78} y={8} w={87} h={58} thought={variant !== 'action'}><Book x={30} y={28}/><g transform="translate(67 23) scale(.65)"><Question x={0} y={0}/></g></Bubble> : hardThought ? <Bubble x={77} y={8} w={85} h={58} thought><Ball x={42} y={29}/></Bubble> : null}
    </>);
    case 'new-place': return localizeView(<>
      <Doorway x={233} y={65}/><Person x={61} y={88} pose={helping ? 'wave' : 'rest'} mood={mood} gaze="right"/><path d="M37 121h-11v41h18" fill="#bfd0df" stroke={ink} strokeWidth={3}/><path d="M108 178q39-10 62-5" fill="none" stroke="#a7bfd0" strokeWidth={5} strokeDasharray="8 7"/>
      {helping ? <><g transform="translate(90 71) scale(.86)"><Teacher x={54} y={5}/></g><Bubble x={78} y={7} w={82} h={54}><Question x={35} y={20}/></Bubble></> : <Bubble x={89} y={8} w={83} h={61} thought><Question x={35} y={24}/></Bubble>}
    </>);
    default: return null;
  }
}

const sceneDescriptions: Record<RebtVisual, string> = {
  wait: '한 학생이 차례를 기다리고, 앞 학생이 물건을 사용해요. 옆에 기다리는 시계가 있어요.',
  change: '활동 순서표의 책과 공 순서가 화살표로 바뀌었어요. 학생이 새 순서를 보고 있어요.',
  problem: '학생이 보고 있는 학습지의 한 문제에 틀림 표시가 있어요.',
  study: '학생이 처음 하는 모양 분류 활동을 보고 있어요. 선생님이 동그라미를 같은 모양 칸에 넣는 방법을 보여 줘요.',
  greeting: '한 학생이 손을 들어 인사하지만, 친구는 다른 쪽을 보고 있어요.',
  game: '두 학생이 보드게임을 했어요. 친구에게 승리 메달이 있고, 학생은 아쉬워해요.',
  laugh: '두 친구가 서로 마주 보고 웃고 있고, 다른 학생이 조금 떨어져 바라봐요.',
  share: '함께 쓰는 놀이 물건을 친구가 먼저 들고 있고, 다른 학생도 그 물건을 바라봐요.',
  sort: '네모 상자에 네모 두 개는 알맞게 들어갔고, 동그라미 한 개만 다른 상자에 들어갔어요. 옆에 동그라미 상자가 있어요.',
  feedback: '선생님이 블록 탑의 기울어진 맨 위 한 부분을 가리켜요. 아래쪽 블록들은 그대로 있어요.',
  'play-choice': '학생은 공놀이를 떠올리고, 친구는 블록 놀이를 떠올려요. 두 사람이 원하는 놀이가 달라요.',
  presentation: '앞에서 학생이 그림 자료를 들고 발표해요. 앉아 있는 두 친구가 발표하는 학생과 자료를 바라보며 듣고 있어요.',
  hello: '실습 이름표를 단 새로운 사람과 학생이 마주 보고 처음 인사해요.',
  'friend-other': '내 옆자리 친구가 다른 친구와 공을 가지고 이야기해요. 나는 조금 떨어진 책상 옆에서 바라봐요.',
  'friend-refusal': '나는 친구에게 책을 부탁하고, 친구는 책을 든 채 손바닥을 보여 거절해요.',
  'friend-conflict': '두 학생이 서로를 향해 말하고 있어요. 걱정스러운 표정과 엇갈린 말풍선이 보여요.',
  'presentation-anxiety': '학생이 발표 자료를 들고 발표할 앞자리를 바라봐요. 아직 발표를 시작하지 않았어요.',
  'slow-finish': '한 학생이 블록 활동을 마쳤어요. 먼저 끝낸 친구는 가방을 챙겼고, 두 학생 사이에 시계가 보여요.',
  'meal-spill': '학생이 든 급식판이 기울어 밥과 반찬이 바닥에 쏟아졌어요.',
  'friend-mistake': '반대 방향으로 걷던 두 학생의 어깨가 부딪혔어요. 두 학생이 놀라서 서로를 바라봐요.',
  'teacher-mistake': '학생이 선생님을 향해 큰 소리로 말해요. 굵고 넓은 말풍선이 목소리 크기를 나타내요.',
  'practice-mistake': '음료 기계 앞에서 실습하는 학생의 컵이 옆으로 넘어져 음료가 흘렀어요.',
  'denied-activity': '학생이 하고 싶은 영상 활동을 가리키지만 기기에 잠금 표시가 있어요.',
  'unfair-scolding': '옆에 다른 학생도 있는데, 선생님이 나를 향해서만 이야기하고 있어요.',
  'peer-praise': '선생님이 옆 친구에게 별 모양 칭찬 말풍선을 보여 주고, 나는 바라보고 있어요.',
  'peer-comparison': '내 블록은 아직 낮게 쌓였고, 친구는 더 높은 블록 작품을 만들었어요.',
  'no-award': '앞에 선 두 친구는 상을 받았고, 나는 상 없이 그 모습을 바라봐요.',
  'appearance-teasing': '한 학생이 다른 학생의 얼굴을 가리키며 놀리는 말을 해요. 듣는 학생은 불편해해요.',
  'nickname-teasing': '친구가 이름표 모양이 있는 말풍선으로 별명을 불러요. 듣는 학생은 불편해해요.',
  'cancelled-activity': '기대했던 공놀이 활동이 달력에서 취소 표시되어 있어요.',
  'new-place': '학생이 가방을 메고 처음 방문하는 실습장 입구 앞에 서 있어요.',
  custom: '학생이 말풍선과 그림 카드를 가리켜 자신의 이야기를 표현해요.',
};

/** The same scene stays visible while the action changes, so a nonreader can compare choices. */
function Scene({ visual, variant, sentence, flexible }: { visual: RebtVisual; variant: Variant; sentence: string; flexible?: boolean }) {
  const expandedScene = ExpandedScene({ visual, variant, sentence, flexible });
  if (expandedScene) return expandedScene;
  const actionScene = variant === 'action' ? ActionScene({ visual, sentence }) : null;
  if (actionScene) return actionScene;
  const scene = variant === 'scene';
  const thought = variant === 'thought';
  // When available, the content's classification is authoritative; the fallback only supports older saved cards.
  const blocked = thought && (flexible === false || (flexible !== true && /절대|아무것도 할 수 없어|하나도 못|다 망|끝이야|큰일 나|전부 못한|모두 틀렸어|처음부터 혼자 잘해야|꼭 내가 이겨야|내 차례여야|골라야 해|나를 싫어하는 거야|나를 나쁘게/.test(sentence)));
  const asking = /물어|달라고|묻기/.test(sentence);
  const together = /함께|도움|선생님/.test(sentence);
  const mood: Mood = blocked ? 'worried' : 'calm';
  const helpSentence = variant === 'help' ? sentence : '';
  const moreTime = helpSentence === '바뀐 순서에 익숙해질 시간이 필요할 수 있어.';
  const learningSupport = helpSentence === '처음에는 도움을 받으며 배워도 괜찮아.' || helpSentence === '어려운 부분은 도움을 받으며 배워도 괜찮아.';
  const learningListenOrThink = helpSentence === '어려울 때는 도움을 부탁해도 괜찮아. 설명을 다시 듣거나 내용을 천천히 생각해 보자.' || helpSentence === '어려울 때는 도움을 부탁해도 괜찮아. 설명을 다시 듣거나 방법을 천천히 생각해 보자.';
  const reviewMistake = helpSentence === '틀릴 수 있어. 왜 틀렸는지 살펴보고 다시 해 보자.';
  const learningNotAll = helpSentence === '처음부터 모두 잘할 필요는 없어.';
  const oneNotAll = helpSentence === '하나를 잘못했다고 전부 못한 건 아니야.';
  const repairSupport = helpSentence === '고칠 부분은 도움을 받으며 배워도 괜찮아.';
  const feedbackMeaning = helpSentence === '고칠 부분을 알려 주신 걸 수도 있어. 어떤 뜻인지 물어봐도 돼.';
  const newOrder = helpSentence === '바뀌어서 당황스럽지만 바뀐 대로 해 볼 수 있어.';
  const bothMayExpress = helpSentence === '친구도 나도 하고 싶은 놀이를 말할 수 있어.';
  const greetingUnknown = helpSentence === '왜 대답하지 않았는지는 아직 몰라.';
  const greetingNotHeard = helpSentence === '친구가 내 인사를 못 들었을 수도 있어.' || helpSentence === '못 들었을 수도 있어. 다음에 다시 인사해 보자.';
  const gamePractice = helpSentence === '연습하면서 조금씩 더 잘할 수 있어.';
  const presentationCurious = helpSentence === '친구들이 내 발표가 궁금해서 집중하고 있나 봐.';
  switch (visual) {
    case 'wait': return localizeView(<>
      <Person x={66} y={85} mood={mood} pose={asking ? 'point' : 'rest'} gaze="right"/>
      <Person x={248} y={94} scale={.85} color={gold} pose="hold"/><Blocks x={248} y={140}/>
      <path d="M126 174h63" stroke="#b5c8dc" strokeWidth="5" strokeDasharray="9 7"/>
      {together && !asking ? <Bubble x={105} y={15} w={101} h={62} thought={thought}><Person x={30} y={8} scale={.42}/><Person x={71} y={4} scale={.46} color={purple}/></Bubble> : asking ? <Bubble x={111} y={24} w={92} h={65}><Clock x={29} y={31} r={20}/><Question x={64} y={25}/></Bubble> : blocked ? <Bubble x={87} y={9} w={103} h={65} thought><circle cx="27" cy="22" r="10" fill="#f8d6bc" stroke={ink} strokeWidth="2"/><path d="M16 48v-8q11-17 22 0v8" fill={blue} stroke={ink} strokeWidth="2"/><Blocks x={71} y={33}/></Bubble> : <>
        <rect x="107" y="18" width="105" height="51" rx="12" fill="white" stroke="#819bb5" strokeWidth="2.5"/>
        <circle cx="128" cy="34" r="8" fill="#f8d6bc" stroke={ink} strokeWidth="2"/><path d="M118 59V51q10-15 20 0v8" fill={gold} stroke={ink} strokeWidth="2"/>
        <Arrow x={159} y={45}/><circle cx="190" cy="34" r="8" fill="#f8d6bc" stroke={ink} strokeWidth="2"/><path d="M180 59V51q10-15 20 0v8" fill={blue} stroke={ink} strokeWidth="2"/>
        <Clock x={157} y={121} r={27} small/>
      </>}
    </>);
    case 'change': return localizeView(<>
      <Person x={64} y={86} mood={mood} pose="point"/>
      <ActivityOrder x={139} y={37}/>
      {moreTime ? <Bubble x={23} y={8} w={73} h={52} thought><Clock x={36} y={26} r={19} small/></Bubble> : newOrder ? <Bubble x={21} y={8} w={91} h={51} thought><Ball x={23} y={26} r={12}/><g transform="translate(69 27) scale(.62)"><Book x={0} y={0}/></g><path d="M40 26h11m-5-5 5 5-5 5" stroke="#527db2" strokeWidth={2.5} fill="none"/></Bubble> : blocked ? <Bubble x={28} y={9} w={63} h={44} thought><path d="M20 14v17M20 22h23m-7-7 7 7-7 7" fill="none" stroke="#527db2" strokeWidth="3.5" strokeLinecap="round"/></Bubble> : asking ? <Bubble x={30} y={10} w={61} h={43}><Question x={24} y={11}/></Bubble> : null}
    </>);
    case 'problem': return localizeView(<>
      <Person x={70} y={81} mood={mood} pose={blocked ? 'stop' : 'point'}/>
      {blocked ? <><Sheet x={128} y={75} wrong scale={.7}/><Sheet x={182} y={75} wrong scale={.7}/><Sheet x={236} y={75} wrong scale={.7}/><Cross x={206} y={163} size={16}/></> : <>
        <Sheet x={152} y={71} wrong={scene || thought} one={!scene && !thought}/>
        {together ? <><Person x={275} y={82} scale={.9} color={purple} pose="point"/><Pencil x={226} y={144}/></> : <Pencil x={238} y={119}/>}
        {thought && <Bubble x={169} y={7} w={68} h={42} thought><Question x={26} y={12}/></Bubble>}
        {reviewMistake && <Bubble x={100} y={7} w={127} h={54} thought><Question x={26} y={20}/><g transform="translate(80 26) scale(.78)"><Repeat x={0} y={0}/></g></Bubble>}
        {!scene && !thought && <Arrow x={141} y={159}/>}
      </>}
    </>);
    case 'study': return localizeView(<>
      <Person x={56} y={88} mood={blocked ? 'worried' : 'calm'} pose="point" gaze="right"/>
      <Person x={274} y={70} scale={1.05} color={purple} pose="hold" gaze="left"/>
      <rect x="112" y="122" width="112" height="57" rx="12" fill="white" stroke="#819bb5" strokeWidth="3"/>
      <circle cx="142" cy="149" r="17" fill="#e9f2f9" stroke="#527db2" strokeWidth="3" strokeDasharray="4 3"/>
      <rect x="177" y="133" width="31" height="31" rx="4" fill="#fff1d9" stroke="#a68043" strokeWidth="3"/>
      <circle cx="258" cy="126" r="12" fill="#8bb9df" stroke={ink} strokeWidth="3"/>
      <path d="M239 121q-46-29-88 3" fill="none" stroke="#527db2" strokeWidth="3.5" strokeDasharray="5 4"/>
      <path d="M151 111v13l13-3" fill="none" stroke="#527db2" strokeWidth="3.5" strokeLinecap="round"/>
      {learningListenOrThink ? <Bubble x={86} y={7} w={119} h={64} thought><ListeningEar x={17} y={9} scale={.82}/><path d="M59 13v38" stroke="#c4d3e1" strokeWidth="2"/><g transform="translate(88 27) scale(.85)"><Question x={0} y={0}/></g></Bubble> : learningSupport ? <Bubble x={86} y={7} w={94} h={64} thought><SupportPair/></Bubble> : learningNotAll ? <Bubble x={84} y={10} w={104} h={61} thought><circle cx={22} cy={30} r={12} fill="#8bb9df" stroke={ink} strokeWidth="2.5"/><circle cx={53} cy={30} r={12} fill="white" stroke="#819bb5" strokeWidth="2.5" strokeDasharray="4 3"/><circle cx={84} cy={30} r={12} fill="white" stroke="#819bb5" strokeWidth="2.5" strokeDasharray="4 3"/></Bubble> : blocked ? <Bubble x={85} y={9} w={91} h={62} thought><circle cx={28} cy={30} r={12} fill="#8bb9df" stroke={ink} strokeWidth="2.5"/><rect x={54} y={18} width={25} height={25} rx={4} fill="#fff1d9" stroke="#a68043" strokeWidth="2.5"/><path d="M17 13l59 36M76 13 17 49" stroke="#a56e68" strokeWidth="4" strokeLinecap="round"/></Bubble> : <Bubble x={84} y={10} w={87} h={57} thought={thought}><Question x={36} y={20}/></Bubble>}
    </>);
    case 'greeting': return localizeView(<>
      <Person x={79} y={83} pose="wave" mood={blocked ? 'sad' : 'calm'}/>
      <Person x={242} y={83} color={gold} facing="away"/>
      {variant === 'action' ? <><Arrow x={157} y={124}/><Clock x={161} y={48} r={23} small/></> : blocked ? <Bubble x={99} y={15} w={91} h={59} thought><path d="M33 19c-19-19-35 10 0 31 36-21 20-50 0-31" fill="#eea3ae" stroke="none"/><path d="M35 8l-9 17 12 7-9 21" stroke="white" strokeWidth="5"/></Bubble> : greetingNotHeard ? <Bubble x={100} y={8} w={112} h={65} thought><ListeningEar x={18} y={7} scale={.85}/><g transform="translate(83 29) scale(.8)"><Question x={0} y={0}/></g><path d="M6 26h7m-7 9h7" stroke="#819bb5" strokeWidth="2.5" strokeDasharray="2 2"/></Bubble> : !scene ? <><Bubble x={103} y={12} w={83} h={60} thought><Question x={37} y={23}/></Bubble>{!greetingUnknown && <path d="M266 93q17 0 17 16M277 83q20 4 20 23" stroke="#a9bbcf" strokeWidth="3" fill="none"/>}</> : <Bubble x={109} y={28} w={71} h={45}><path d="M19 27v-9m9 13V10m9 22V17m9 8v-6" stroke="#527db2" strokeWidth="4" strokeLinecap="round"/></Bubble>}
    </>);
    case 'game': return localizeView(<>
      <Person x={62} y={89} scale={.9} mood={scene || thought || /아쉬운/.test(sentence) ? 'sad' : 'calm'} pose={gamePractice ? 'point' : /축하/.test(sentence) ? 'wave' : 'rest'}/>
      <Person x={267} y={89} scale={.9} color={gold}/>
      <rect x="119" y="113" width="91" height="61" rx="8" fill="#d8e9dc" stroke="#789985" strokeWidth="3"/>
      <path d="M125 143h78M150 119v49M180 119v49" stroke="#9ebaaa" strokeWidth="2"/><circle cx="137" cy="134" r="9" fill={blue}/><circle cx="193" cy="159" r="9" fill={gold}/>
      <Medal x={264} y={51} small/>
      {gamePractice ? <Bubble x={104} y={9} w={100} h={70} thought><rect x={29} y={22} width={42} height={30} rx={5} fill="#d8e9dc" stroke="#789985" strokeWidth={2.5}/><path d="M43 24v25m14-25v25M32 37h36" stroke="#9ebaaa" strokeWidth={2}/><circle cx={50} cy={38} r={6} fill={blue} stroke={ink} strokeWidth={2}/><path d="M17 43q-8-28 25-31m-7-6 7 6-7 7M83 26q8 29-24 33m7-7-7 7 7 6" fill="none" stroke="#527db2" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"/></Bubble> : blocked ? <Bubble x={25} y={4} w={73} h={55} thought><Medal x={36} y={24} small/></Bubble> : /쉬/.test(sentence) ? <><RestChair x={168} y={51}/><Clock x={213} y={43} r={21} small/></> : /표현/.test(sentence) ? <Bubble x={108} y={21} w={87} h={58}><circle cx="44" cy="28" r="18" fill="#f8d6bc" stroke={ink} strokeWidth="2"/><circle cx="38" cy="24" r="2" fill={ink}/><circle cx="50" cy="24" r="2" fill={ink}/><path d="M37 36q7-7 14 0" fill="none" stroke={ink} strokeWidth="2"/></Bubble> : !scene && !thought && /못난|소중/.test(sentence) ? <Bubble x={106} y={19} w={91} h={58} thought><Person x={27} y={8} scale={.38}/><path d="M67 12l4 9 10 2-7 7 1 10-8-5-9 5 2-10-8-7 11-2z" fill="#f4d58c" stroke="#a68043" strokeWidth="2"/></Bubble> : !scene && !thought ? <Bubble x={105} y={17} w={92} h={62} thought><circle cx="22" cy="39" r="9" fill={blue} stroke={ink} strokeWidth="2"/><circle cx="70" cy="39" r="9" fill={gold} stroke={ink} strokeWidth="2"/><path d="M31 31l14-10 16 10" fill="none" stroke="#819bb5" strokeWidth="2.5"/><g transform="translate(45 20) scale(.75)"><Medal x={0} y={0} small/></g></Bubble> : null}
    </>);
    case 'laugh': return localizeView(<>
      <Person x={57} y={85} mood={/나를 보고/.test(sentence) ? 'worried' : 'calm'} pose={asking ? 'point' : 'rest'}/>
      <Person x={209} y={95} scale={.85} color={gold} mood="smile"/><Person x={272} y={95} scale={.85} color={purple} mood="smile"/>
      <Bubble x={175} y={12} w={98} h={55}><path d="M19 34q12 13 23 0M57 34q12 13 23 0" fill="none" stroke="#667589" strokeWidth="3" strokeLinecap="round"/><circle cx="29" cy="22" r="2.5" fill="#667589"/><circle cx="67" cy="22" r="2.5" fill="#667589"/></Bubble>
      {/나를 보고/.test(sentence) ? <><path d="M173 90L94 66" stroke="#809bb7" strokeWidth="3" strokeDasharray="5 5"/><Bubble x={18} y={4} w={62} h={47} thought><path d="M19 30q12 12 24 0" fill="none" stroke="#667589" strokeWidth="3"/><circle cx="23" cy="20" r="2" fill="#667589"/><circle cx="39" cy="20" r="2" fill="#667589"/></Bubble></> : !scene ? <Bubble x={85} y={44} w={64} h={48} thought={!asking}><Question x={25} y={16}/></Bubble> : null}
    </>);
    case 'share': return localizeView(<>
      <Person x={76} y={84} mood={/빼앗/.test(sentence) ? 'worried' : 'calm'} pose="point"/>
      <Person x={244} y={84} color={gold} pose="hold"/><Blocks x={244} y={141}/>
      <rect x="120" y="134" width="55" height="39" rx="8" fill="#e4edf5" stroke="#819bb5" strokeWidth="3"/><path d="M130 145h35" stroke="#819bb5" strokeWidth="3"/>
      {asking ? <Bubble x={108} y={17} w={95} h={65}><Clock x={29} y={32} r={20}/><Question x={66} y={26}/></Bubble> : /빼앗/.test(sentence) ? <Bubble x={32} y={4} w={80} h={55} thought><Blocks x={42} y={27}/><Arrow x={14} y={25} direction="left" color="#ba656b"/></Bubble> : thought ? <Bubble x={44} y={4} w={80} h={55} thought><Blocks x={40} y={29}/></Bubble> : !scene ? <><Arrow x={181} y={54} direction="left"/><Clock x={135} y={49} r={21} small/></> : null}
    </>);
    case 'sort': return localizeView(<>
      <Person x={57} y={88} mood={mood} pose="point" gaze="right"/>
      <ShapeTray x={167} y={130} wrong={scene || thought || oneNotAll}/><ShapeTray x={264} y={130} shape="round"/>
      {oneNotAll ? <Bubble x={96} y={11} w={116} h={61} thought><rect x={13} y={18} width={22} height={22} rx={3} fill="#f2ce8b" stroke={ink} strokeWidth="2.5"/><rect x={45} y={18} width={22} height={22} rx={3} fill="#f2ce8b" stroke={ink} strokeWidth="2.5"/><circle cx={91} cy={29} r={12} fill="#8bb9df" stroke={ink} strokeWidth="2.5"/><path d="M13 49h54" stroke="#527db2" strokeWidth="3"/><circle cx={91} cy={29} r={19} fill="none" stroke="#819bb5" strokeWidth="2" strokeDasharray="4 3"/></Bubble> : blocked ? <Bubble x={88} y={13} w={126} h={62} thought><rect x="13" y="19" width="21" height="21" rx="3" fill="#f2ce8b" stroke={ink} strokeWidth="2"/><circle cx="53" cy="30" r="11" fill="#8bb9df" stroke={ink} strokeWidth="2"/><rect x="73" y="19" width="19" height="21" rx="3" fill="#f2ce8b" stroke={ink} strokeWidth="2"/><path d="M10 48h84" stroke="#809bb7" strokeWidth="3"/><g transform="translate(106 23) scale(.65)"><Question x={0} y={0}/></g></Bubble> : !scene && !thought ? <><circle cx="203" cy="81" r="11" fill="#8bb9df" stroke={ink} strokeWidth="3"/><path d="M217 82q28-6 43 16" fill="none" stroke="#527db2" strokeWidth="3.5"/><path d="M250 97l11 3 1-11" fill="none" stroke="#527db2" strokeWidth="3.5" strokeLinecap="round"/></> : null}
    </>);
    case 'feedback': return localizeView(<>
      <Person x={52} y={89} mood={mood} gaze="right"/>
      <Person x={265} y={72} color={purple} scale={1.05} gaze="left"/>
      <Tower x={164} y={142} highlight/>
      <path d="M238 119l-28-15-25 3" stroke={ink} strokeWidth="4" strokeLinecap="round" fill="none"/>
      <Bubble x={111} y={9} w={96} h={64} thought={blocked || repairSupport || feedbackMeaning}>{repairSupport ? <SupportPair/> : feedbackMeaning ? <><rect x="13" y="22" width="29" height="22" rx="3" fill="#b5cfae" stroke={ink} strokeWidth="2.5"/><Question x={67} y={26}/></> : <><rect x="26" y="18" width="33" height="23" rx="3" fill="#b5cfae" stroke={ink} strokeWidth="2.5" transform="rotate(18 42 30)"/><path d="M19 41q-10-22 10-29m-8-1 8 1-2 8" fill="none" stroke="#527db2" strokeWidth="3" strokeLinecap="round"/></>}</Bubble>
      {blocked && <path d="M118 189v-9m92 9v-9M118 185h92" stroke="#809bb7" strokeWidth="3" strokeDasharray="5 4"/>}
    </>);
    case 'play-choice': return localizeView(<>
      <Person x={73} y={88} mood={mood} pose="hold" gaze="right"/>
      <Person x={245} y={88} color={gold} pose="hold" gaze="left"/>
      <Ball x={73} y={142}/><Blocks x={245} y={145}/>
      <Bubble x={23} y={10} w={91} h={57} thought={!bothMayExpress}><Ball x={45} y={28}/></Bubble>
      <Bubble x={203} y={10} w={91} h={57} thought={!bothMayExpress}><Blocks x={46} y={31}/></Bubble>
      {blocked ? <><path d="M117 31h58m-10-10 10 10-10 10" stroke="#809bb7" strokeWidth="4" fill="none" strokeLinecap="round"/><Ball x={158} y={68} r={12}/></> : bothMayExpress ? <><path d="M132 114h56m-10-8 10 8-10 8M188 143h-56m10-8-10 8 10 8" fill="none" stroke="#527db2" strokeWidth="3.5" strokeLinecap="round"/></> : !scene ? <><path d="M132 116v48M187 116v48" stroke="#aabfd2" strokeWidth="3" strokeDasharray="5 5"/><path d="M137 96l11 9 19-23" stroke="#527db2" strokeWidth="3.5" strokeLinecap="round" fill="none"/></> : null}
    </>);
    case 'presentation': return localizeView(<>
      <Person x={61} y={86} mood={mood} pose="point" gaze="right"/>
      <rect x="109" y="63" width="81" height="83" rx="7" fill="white" stroke="#819bb5" strokeWidth="3"/>
      <path d="M116 117l18-25 17 20 12-13 20 26h-67z" fill="#accbb2"/><circle cx="170" cy="81" r="9" fill="#f1cd7f"/>
      <path d="M125 134h49" stroke="#9cb2c7" strokeWidth="4" strokeLinecap="round"/>
      <path d="M218 161h26m-24 0v25m22-25v25M274 164h27m-25 0v23m23-23v23" stroke="#afbeca" strokeWidth="5" strokeLinecap="round" fill="none"/>
      <Person x={231} y={110} scale={.70} color={gold} gaze="left"/>
      <Person x={284} y={114} scale={.68} color={purple} gaze="left"/>
      <path d="M210 115l-14-10M262 119l-14-8" stroke="#819bb5" strokeWidth="2.5" strokeDasharray="3 4" fill="none"/>
      {presentationCurious ? <Bubble x={194} y={10} w={112} h={63} thought><Poster x={15} y={11} scale={.47}/><g transform="translate(83 28) scale(.76)"><Question x={0} y={0}/></g><path d="M9 12v-5h11m75 0h9v9M9 48v7h11m75 0h9v-7" fill="none" stroke="#527db2" strokeWidth={2.5} strokeLinecap="round"/></Bubble> : blocked ? <Bubble x={24} y={8} w={74} h={51} thought><Question x={30} y={17}/></Bubble> : !scene ? <Bubble x={201} y={16} w={94} h={57} thought><rect x="14" y="15" width="29" height="25" rx="3" fill="#e6eff6" stroke="#819bb5" strokeWidth="2"/><path d="M17 34l7-10 6 7 5-5 5 10" stroke="#8cac92" fill="none" strokeWidth="2.5"/><path d="M60 14c-17-4-20 18-9 22v8h9v-10c13-3 15-16 7-21m-11 12c3-8 10-7 9-1" fill="none" stroke="#527db2" strokeWidth="2.5" strokeLinecap="round"/></Bubble> : <path d="M77 73q9-5 15 0m-13-11q15-7 25 1" fill="none" stroke="#819bb5" strokeWidth="2.5" strokeLinecap="round"/>}
    </>);
    case 'hello': return localizeView(<>
      <Person x={78} y={83} mood={mood} pose="wave"/>
      <Person x={245} y={71} scale={1.06} color={purple} pose="wave"/>
      <rect x="244" y="110" width="22" height="14" rx="3" fill="white" stroke="#7b7d9c" strokeWidth="2"/>
      {blocked ? <Bubble x={111} y={12} w={82} h={60} thought><Cross x={30} y={27} size={16}/><path d="M61 14v20m0 9v1" stroke="#ba656b" strokeWidth="5" strokeLinecap="round"/></Bubble> : variant === 'help' ? <Bubble x={112} y={23} w={82} h={57}><Clock x={29} y={28} r={19} small/><path d="M57 24h10m-10 9h10" stroke="#527db2" strokeWidth="4" strokeLinecap="round"/></Bubble> : variant === 'action' ? <><Bubble x={112} y={23} w={82} h={57}><path d="M19 32v-10m10 14V14m10 23V22m10 9v-8" stroke="#527db2" strokeWidth="4" strokeLinecap="round"/></Bubble><Arrow x={162} y={133}/></> : <Bubble x={118} y={13} w={66} h={55} thought={thought}><Question x={25} y={20}/></Bubble>}
    </>);
    default: return localizeView(<><Person x={73} y={84} pose="point"/><Bubble x={144} y={31} w={123} h={111}><rect x="15" y="18" width="39" height="33" rx="5" fill="#d6e9db"/><path d="M20 44l12-17 15 17" fill="#8bac96"/><circle cx="39" cy="26" r="4" fill="#f2cf7e"/><rect x="67" y="18" width="39" height="33" rx="5" fill="#dbe9f5"/><path d="M76 27h21M76 36h16M18 75h85M18 88h65" stroke="#8ba3ba" strokeWidth="4" strokeLinecap="round"/></Bubble></>);
  }
}

/** Custom text uses a neutral communication picture; it never invents a scene for free text. */
export default function RebtPicture({ visual, variant = 'scene', sentence = '', flexible, preserveText = false }: {
  visual: RebtVisual; character?: Student | null; variant?: Variant; sentence?: string; flexible?: boolean; preserveText?: boolean;
}) {
  const titleId = useId();
  return localizeView(<span className={`rebt-picture rebt-picture--${visual}`} style={{borderRadius:18, background:'#f4f8fb', overflow:'hidden'}}>
    <svg width="100%" height="100%" viewBox="0 0 320 200" role="img" aria-labelledby={titleId} style={{display:'block'}}>
      <title id={titleId} translate={preserveText && sentence ? 'no' : undefined}>{sentence || sceneDescriptions[visual]}</title>
      <path d="M22 188h276" stroke="#dae5ed" strokeWidth="4" strokeLinecap="round"/>
      <Scene visual={visual} variant={variant} sentence={sentence} flexible={flexible}/>
    </svg>
  </span>);
}
