/** Optional teacher reference; student activities keep their current wording. */
export default function TeacherRecordHelp() {
  const terms = [
    ['자기보고', '학생이 자신의 마음을 직접 고른 내용이에요. 학생이 가리킨 답을 교사가 대신 눌러도, 학생이 고른 답이면 자기보고예요.'],
    ['연습 수행', '앱이나 수업에서 예시로 해 본 활동이에요. 연습 카드를 누른 것만으로 생활 속에서 스스로 표현했다고 기록하지 않아요.'],
    ['교사 관찰', '선생님이 직접 보고 확인한 행동, 요청, 제공된 도움을 적은 내용이에요. 학생이 선택한 마음과는 구분해 기록해요.'],
    ['회기', '시작 화면에서 활동을 시작한 한 번의 사용 묶음이에요. 그 안에 기분 선택·도움 요청 등 여러 기록이 생겨도, 같은 관찰은 한 기록에만 추가해요.'],
    ['분모', '‘2 / 5’에서 비교 기준이 되는 전체 수인 5를 말해요. 요청할 기회가 5회이고 스스로 요청한 것이 2회라면 ‘5회 중 2회(40%)’예요. 이 비율만으로 앱의 효과를 판단하지 않아요. 그래프마다 함께 계산한 기록의 범위를 확인해 주세요.'],
    ['일반화', '연습한 표현을 다른 장소나 다른 사람과의 실제 상황에서도 사용하는 것이에요. 장소의 종류가 많다는 것만으로 일반화됐다고 판단하지 않아요.'],
  ];
  return <details className="rounded-2xl border border-slate-200 bg-white">
    <summary className="min-h-11 cursor-pointer rounded-2xl px-4 py-3 font-bold">기록 용어 쉽게 보기</summary>
    <dl className="grid gap-4 px-4 pb-4 sm:grid-cols-2">
      {terms.map(([term, description]) => <div key={term}>
        <dt className="font-bold text-slate-800">{term}</dt>
        <dd className="mt-1 text-sm leading-relaxed text-slate-700">{description}</dd>
      </div>)}
    </dl>
  </details>;
}
