import { localizeView } from '../i18n/localizeView';
import { createRebtLesson, type PowerCardLesson } from '../learning/powerCardLesson';
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Flag, Gamepad2, Lightbulb, RotateCcw, Square, Trophy, Volume2, VolumeX } from 'lucide-react';
import type { Difficulty, Student } from '../types';
import { SIMPLE_REBT_SCENARIOS } from '../learning/simpleRebt';
import { MAZE_COLS, MAZE_ROWS, MAZE_GATES, MAZE_GOAL, MAZE_START, getMazeMapDescription, getMazeNavigation, isMazePath, mazeChoiceForSide, moveRebtMaze, selectRandomMaze, type Direction } from '../learning/rebtPathGame';
import { useGameCelebration } from '../hooks/useGameCelebration';
import { createMazePointerActivation } from '../lib/mazePointerActivation';
import { useActivityDraftState } from '../hooks/useActivityDraft';
import RebtPicture from './RebtPicture';
import RebtSupportExpressions, { hasRebtSupportExpressions } from './RebtSupportExpressions';
import './RebtPathGame.css';

interface Props {
  character?: Student | null;
  difficulty: Difficulty;
  onRead: (text: string) => void;
  onStopReading: () => void;
  onExit: () => void;
  onComplete: (summary: string, chosenThought: string, lesson?: PowerCardLesson) => void;
  voiceError?: string;
  reading?: boolean;
}
const directions = [
  {id:'up', name:'위로 이동', Icon:ArrowUp},
  {id:'left', name:'왼쪽으로 이동', Icon:ArrowLeft},
  {id:'down', name:'아래로 이동', Icon:ArrowDown},
  {id:'right', name:'오른쪽으로 이동', Icon:ArrowRight},
] as const;
const arrowKeys: Record<string, Direction> = {ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};

export default function RebtPathGame({character,difficulty,onRead,onStopReading,onExit,onComplete,voiceError,reading = false}: Props) {
  const [state,setState] = useActivityDraftState('rebt.gameState', () => selectRandomMaze(SIMPLE_REBT_SCENARIOS));
  const stateRef = useRef(state);
  const boardRef = useRef<HTMLDivElement>(null);
  const winRef = useRef<HTMLHeadingElement>(null);
  const [pointerActivation] = useState(createMazePointerActivation);
  const [celebration,setCelebration] = useState(0);
  const [gateRewardVisible,setGateRewardVisible] = useState(false);
  const [gateRewardKey,setGateRewardKey] = useState(0);
  const gateRewardedRoundRef = useRef<string | null>(state.passedGate ? `${state.scenarioId}-${state.helpfulSide}` : null);
  const gateRewardTimerRef = useRef<number | null>(null);
  const gateNarrationTimerRef = useRef<number | null>(null);
  const [autoNarration,setAutoNarration] = useActivityDraftState('rebt.gameAutoNarration', true);
  const autoNarrationRef = useRef(autoNarration);
  const [introducedScenario,setIntroducedScenario] = useActivityDraftState<string | undefined>('rebt.gameIntroducedScenario', undefined);
  const [effectsEnabled,setEffectsEnabled] = useActivityDraftState('rebt.gameEffectsEnabled', true);
  const [navigationAction,setNavigationAction] = useState<{ direction?: Direction; sequence: number }>({ sequence: 0 });
  const sound = useGameCelebration({ initialEnabled: effectsEnabled, onEnabledChange: setEffectsEnabled });
  const picture = difficulty === '그림';
  const short = difficulty !== '글';
  const scenario = SIMPLE_REBT_SCENARIOS.find(item => item.id === state.scenarioId)!;
  const helpful = scenario.alternatives.find(item => item.id === state.helpfulId)!;
  const navigation = getMazeNavigation(state,navigationAction.direction);

  const clearGateTimers = () => {
    if (gateRewardTimerRef.current !== null) {
      window.clearTimeout(gateRewardTimerRef.current);
      gateRewardTimerRef.current = null;
    }
    if (gateNarrationTimerRef.current !== null) {
      window.clearTimeout(gateNarrationTimerRef.current);
      gateNarrationTimerRef.current = null;
    }
  };

  const clearGateNarrationTimer = () => {
    if (gateNarrationTimerRef.current !== null) {
      window.clearTimeout(gateNarrationTimerRef.current);
      gateNarrationTimerRef.current = null;
    }
  };

  const readImmediately = (text: string) => {
    clearGateNarrationTimer();
    sound.stop();
    onRead(text);
  };

  const changeAutoNarration = () => {
    // Stopping any current narration also prevents later automatic narration.
    // Turning it back on waits for the next game event; it does not start speech.
    const next = reading ? false : !autoNarrationRef.current;
    autoNarrationRef.current = next;
    setAutoNarration(next);
    clearGateNarrationTimer();
    onStopReading();
  };

  const move = (direction:Direction) => {
    const before = stateRef.current;
    const next = moveRebtMaze(before,direction);
    if(next === before) return;
    stateRef.current = next;
    setState(next);
    setNavigationAction(previous=>({direction,sequence:previous.sequence+1}));
    if(next.phase === 'won') {
      clearGateTimers();
      setGateRewardVisible(false);
      onStopReading();
      setCelebration(value=>value+1);
      sound.play();
    } else if(next.feedback === 'think-again' && before.feedback !== 'think-again') {
      if(autoNarrationRef.current) {
        clearGateNarrationTimer();
        onRead(picture ? scenario.pictureCheck : scenario.check);
      }
    } else if(!before.passedGate && next.passedGate) {
      const roundKey = `${next.scenarioId}-${next.helpfulSide}`;
      if (gateRewardedRoundRef.current !== roundKey) {
        gateRewardedRoundRef.current = roundKey;
        clearGateTimers();
        onStopReading();
        setGateRewardVisible(true);
        setGateRewardKey(value => value + 1);
        gateRewardTimerRef.current = window.setTimeout(() => {
          setGateRewardVisible(false);
          gateRewardTimerRef.current = null;
        }, 2600);
        if (sound.enabled) {
          sound.playGateReward();
          if (autoNarrationRef.current) {
            gateNarrationTimerRef.current = window.setTimeout(() => {
              gateNarrationTimerRef.current = null;
              if (autoNarrationRef.current && stateRef.current.phase === 'playing') {
                onRead(helpful.sentence);
              }
            }, 1050);
          }
        } else if (autoNarrationRef.current) {
          onRead(helpful.sentence);
        }
      }
    }
  };
  const onMoveKey = (event: KeyboardEvent<HTMLElement>) => {
    const direction = arrowKeys[event.key];
    if(!direction || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    move(direction);
  };
  useEffect(() => {
    const cancelPointer = () => pointerActivation.cancel();
    window.addEventListener('blur',cancelPointer);
    return () => { cancelPointer(); window.removeEventListener('blur',cancelPointer); };
  },[pointerActivation]);
  useEffect(() => {
    if(state.phase === 'won') winRef.current?.focus({preventScroll:true});
    else boardRef.current?.focus({preventScroll:true});
  },[state.phase]);
  useEffect(() => {
    // Returning from another screen restores the round without replaying its
    // introduction or restarting speech that the learner already stopped.
    if(introducedScenario !== state.scenarioId) {
      setIntroducedScenario(state.scenarioId);
      if(picture && state.phase === 'playing' && autoNarrationRef.current) onRead(`${scenario.sentence} 두 생각을 듣고, 화살표로 길을 찾아가요.`);
    }
    return () => {
      clearGateTimers();
      sound.stop();
      onStopReading();
    };
  },[state.scenarioId]);
  const playAgain = () => {
    pointerActivation.cancel();
    clearGateTimers();
    setGateRewardVisible(false);
    gateRewardedRoundRef.current = null;
    sound.stop();
    onStopReading();
    const next = selectRandomMaze(SIMPLE_REBT_SCENARIOS,state.scenarioId);
    stateRef.current = next; setState(next);
    setNavigationAction(previous=>({sequence:previous.sequence+1}));
  };
  const finish = () => {
    pointerActivation.cancel();
    clearGateTimers();
    setGateRewardVisible(false);
    sound.stop();
    onStopReading();
    onComplete(`생각 바꾸기 · 길 찾기 게임\n연습 상황: ${scenario.sentence}\n게임에서 찾은 도움 되는 생각: ${helpful.sentence}`,helpful.sentence,{ ...createRebtLesson(scenario, helpful), contextLabel: '게임 속 상황' });
  };
  const exit = () => {
    pointerActivation.cancel();
    clearGateTimers();
    setGateRewardVisible(false);
    sound.stop();
    onStopReading();
    onExit();
  };
  const message = gateRewardVisible ? '나를 도와주는 생각을 찾았어요!'
    : state.feedback === 'think-again' ? '이 길은 막혀 있어요. 다른 생각도 살펴봐요.'
    : state.passedGate ? '나를 도와주는 생각을 찾았어요! 길이 열렸어요! 깃발까지 가요.'
    : state.feedback === 'wall' ? '길이 있는 쪽으로 이동해요.' : '두 생각을 보고, 화살표로 길을 찾아가요.';

  const renderThoughtCard = (side: 'left' | 'right') => {
    const card = mazeChoiceForSide(state, scenario, side);
    const thoughtText = short && !picture && !card.sentence.includes(card.word) ? `${card.word}, ${card.sentence}` : card.sentence;
    const isOpenedHelpfulSide = state.passedGate && state.helpfulSide === side;
    return (
      <button
        type="button"
        key={`${scenario.id}-${side}`}
        className={`maze-thought maze-thought-${side} ${isOpenedHelpfulSide ? 'maze-thought-opened' : ''}`}
        aria-label={`${side==='left'?'왼쪽':'오른쪽'} 길 ${thoughtText}, 생각 듣기`}
        onClick={() => readImmediately(card.sentence)}
      >
        <span className="maze-branch-label">
          {side==='left' ? (
            <>
              <ArrowLeft aria-hidden="true" />
              <span>왼쪽 길</span>
            </>
          ) : (
            <>
              <span>오른쪽 길</span>
              <ArrowRight aria-hidden="true" />
            </>
          )}
          <Volume2 aria-hidden="true" />
        </span>
        {short && <RebtPicture visual={card.visual} variant={card.kind==='help'?'help':'thought'} sentence={card.sentence} flexible={card.flexible}/>}
        {!picture && <strong>{short?card.word:card.sentence}</strong>}
      </button>
    );
  };

  return localizeView(<main className={`student-screen rebt-maze-screen ${picture ? 'maze-picture-mode' : short ? 'maze-word-mode' : 'maze-sentence-mode'} ${state.phase === 'won' ? 'maze-won' : ''}`} aria-labelledby="maze-title">
    <header className="maze-header">
      <h1 id="maze-title"><Gamepad2 aria-hidden="true"/>게임하기</h1>
      <div><button type="button" className="maze-auto-narration" onClick={changeAutoNarration} aria-pressed={autoNarration}
        aria-label={reading ? '안내 멈춤, 이후 자동 안내도 끄기' : autoNarration ? '자동 안내 켜짐, 자동 안내 끄기' : '자동 안내 꺼짐, 자동 안내 켜기'}>
        {reading ? <Square aria-hidden="true"/> : autoNarration ? <Volume2 aria-hidden="true"/> : <VolumeX aria-hidden="true"/>}<span>{reading ? '안내 멈춤' : `자동 안내 ${autoNarration?'켜짐':'꺼짐'}`}</span>
      </button><button type="button" onClick={sound.toggle} aria-label={sound.enabled ? '효과음 켜짐, 게임 효과음 끄기' : '효과음 꺼짐, 게임 효과음 켜기'} aria-pressed={sound.enabled}>{sound.enabled ? <Volume2 aria-hidden="true"/>:<VolumeX aria-hidden="true"/>}<span>효과음 {sound.enabled?'켜짐':'꺼짐'}</span></button><button type="button" onClick={exit}>알아보기</button></div>
    </header>
    <div className="sr-only" id="maze-navigation-status" role="status" aria-live={state.phase==='won'?'off':'polite'} aria-atomic="true"><span key={navigationAction.sequence}>{navigation.description}</span></div>
    {state.phase === 'won' ? <>
      <section className={`maze-victory ${hasRebtSupportExpressions(scenario) ? 'maze-victory--support' : ''}`}>
        <div className="maze-fireworks" key={celebration} aria-hidden="true">{Array.from({length:24},(_,i)=><i key={i} style={{'--angle':`${i*137.5}deg`,'--distance':`${75+(i%5)*18}px`,'--delay':`${(i%3)*.2}s`,'--color':['#4285f4','#f9c844','#ee7d6f','#64b9a6'][i%4]} as CSSProperties}/>)}</div>
        <Trophy className="maze-trophy" aria-hidden="true"/>
        <h2 ref={winRef} tabIndex={-1}>길 찾기 성공!</h2><p>나를 도와주는 생각을 찾았어요!</p>
        {character && <img className="maze-winner" src={character.image} alt={character.name}/>}
        <div className="maze-won-thought">{picture ? <RebtPicture visual={helpful.visual} variant="help" sentence={helpful.sentence}/> : <strong>{short?helpful.word:helpful.sentence}</strong>}
          <button type="button" onClick={()=>{sound.stop();onRead(helpful.sentence);}}><Volume2/>찾은 생각 듣기</button>
        </div>
        <button type="button" className="maze-recelebrate" onClick={()=>{onStopReading();setCelebration(value=>value+1);sound.play();}}>축하 한 번 더</button>
        <RebtSupportExpressions scenario={scenario} difficulty={difficulty} onRead={text=>{sound.stop();onRead(text);}}/>
      </section>
      <footer className="maze-win-actions"><button type="button" onClick={playAgain}><RotateCcw/>한 판 더</button><button type="button" className="screen-next" onClick={finish}>활동 후 기분 기록<ArrowRight/></button></footer>
    </> : <>
      <section className="maze-situation" aria-label="이번 게임 상황">
        {short && <RebtPicture visual={scenario.visual} sentence={scenario.sentence}/>}
        <div><span>이번 상황</span>{!picture && <strong>{short?scenario.word:scenario.sentence}</strong>}</div>
        <button type="button" aria-label={`상황 듣기: ${scenario.sentence}`} onClick={()=>readImmediately(scenario.sentence)}><Volume2/><span>상황 듣기</span></button>
      </section>
      <div className="maze-layout">
        <div className="maze-map-area">
          <div className="maze-thoughts" role="group" aria-label="갈림길의 생각">
            {renderThoughtCard('left')}
            {renderThoughtCard('right')}
          </div>
          <div className="maze-board-wrap">
            <div className="maze-board" ref={boardRef} tabIndex={0} role="group" aria-label="방향키로 이동하는 길 찾기 지도" aria-describedby="maze-navigation-status maze-board-tip" onKeyDown={onMoveKey}>
              <p id="maze-board-tip" className="sr-only">지도 또는 이동 버튼에 초점이 있을 때 방향키로 이동해요. 이동 버튼은 Enter나 Space로도 눌러요. Tab을 누르면 지도를 나갈 수 있어요.</p>
              <p className="sr-only">{getMazeMapDescription()}</p>
              {Array.from({length:MAZE_COLS*MAZE_ROWS},(_,index)=>{
                const x=index%MAZE_COLS,y=Math.floor(index/MAZE_COLS),path=isMazePath(x,y);
                const gate=x===MAZE_GATES.left.x&&y===MAZE_GATES.left.y?'left':x===MAZE_GATES.right.x&&y===MAZE_GATES.right.y?'right':null;
                const open=gate===state.helpfulSide&&state.passedGate;
                const goal=x===MAZE_GOAL.x&&y===MAZE_GOAL.y;
                const start=x===MAZE_START.x&&y===MAZE_START.y;
                return <div key={index} aria-hidden="true" className={`maze-cell ${path?'maze-path':'maze-garden'} ${gate?`maze-gate maze-gate-${gate}`:''} ${open?'maze-gate-open':''} ${goal?'maze-goal':''}`}>
                  {gate ? open ? <span>✓</span>:<span>?</span> : goal?<Flag/>:start?<span className="maze-start-label">출발</span>:!path&&index%4===0?<span className="maze-leaf"/>:null}
                </div>;
              })}
              <div className="maze-player" aria-hidden="true" style={{left:`${state.position.x/MAZE_COLS*100}%`,top:`${state.position.y/MAZE_ROWS*100}%`}}>
                {character?<img src={character.image} alt=""/>:<span>●</span>}
              </div>
              {gateRewardVisible && (
                <div className={`maze-gate-reward maze-gate-reward-${state.helpfulSide}`} key={gateRewardKey}>
                  <div className="maze-gate-confetti" aria-hidden="true">
                    {Array.from({ length: 16 }, (_, i) => (
                      <i
                        key={i}
                        style={{
                          '--angle': `${i * 22.5}deg`,
                          '--distance': `${44 + (i % 4) * 14}px`,
                          '--delay': `${(i % 3) * 0.08}s`,
                          '--color': ['#4285f4', '#f9c844', '#ee7d6f', '#34a853'][i % 4],
                        } as CSSProperties}
                      />
                    ))}
                  </div>
                  <div className="maze-gate-reward-card">
                    <span className="maze-gate-clap" aria-hidden="true">
                      <span className="maze-gate-clap-hands">👏</span>
                      <span className="maze-gate-clap-stars">✨🌟✨</span>
                    </span>
                    <strong className="maze-gate-reward-text">나를 도와주는 생각을 찾았어요!</strong>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <aside className="maze-controls">
          <p id="maze-instruction" className={state.feedback==='think-again'?'maze-hint':gateRewardVisible||state.passedGate?'maze-praise-hint':''}>{message}</p>
          <div className="maze-dpad" role="group" aria-label="캐릭터 이동 버튼" onKeyDown={onMoveKey}>
            {directions.map(({id,name,Icon})=><button key={id} type="button" className={`maze-direction maze-direction-${id}`} aria-label={name} aria-describedby={`maze-direction-${id}-info maze-move-tip`}
              onPointerDown={event=>pointerActivation.begin(id,event)}
              onPointerMove={event=>pointerActivation.track(id,event,event.currentTarget.getBoundingClientRect())}
              onPointerUp={event=>pointerActivation.release(id,event,event.currentTarget.getBoundingClientRect())}
              onPointerLeave={()=>pointerActivation.leave(id)} onPointerCancel={()=>pointerActivation.cancel(id)} onBlur={()=>pointerActivation.cancel(id)}
              onClick={event=>{if(pointerActivation.activate(id,event.detail))move(id);}}><Icon aria-hidden="true"/></button>)}
          </div>
          <div className="sr-only">{directions.map(({id})=><p key={id} id={`maze-direction-${id}-info`}>{navigation.directionDescriptions[id]}</p>)}</div>
          <span id="maze-move-tip" className="maze-keyboard-tip">한 번 누르면 한 칸 · 키보드 ↑ ↓ ← →</span>
          <button type="button" className="maze-hint-listen" onClick={()=>readImmediately(`${picture?scenario.pictureCheck:scenario.check} ${helpful.sentence}`)}><Lightbulb/>힌트 듣기</button>
        </aside>
      </div>
    </>}
    {(voiceError || sound.error) && <p className="maze-error" role="status">{voiceError||sound.error}</p>}
  </main>);
}
