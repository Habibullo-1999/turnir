// Static club catalogue used by the club autocomplete on the setup form.
// `i` paths are served from /icons.cc (public assets), same layout as before.
export const CLUBS = [
  // La Liga
  { n: 'Реал Мадрид', l: 'La Liga', f: '🇪🇸', i: 'icons.cc/64x64/real-madrid.football-logos.cc.png' },
  { n: 'Барселона', l: 'La Liga', f: '🇪🇸', i: 'icons.cc/64x64/barcelona.football-logos.cc.png' },
  { n: 'Атлетико Мадрид', l: 'La Liga', f: '🇪🇸', i: 'icons.cc/64x64/atletico-madrid.football-logos.cc.png' },
  { n: 'Севилья', l: 'La Liga', f: '🇪🇸' },
  { n: 'Вильярреал', l: 'La Liga', f: '🇪🇸', i: 'icons.cc/64x64/villarreal.football-logos.cc.png' },
  { n: 'Реал Сосьедад', l: 'La Liga', f: '🇪🇸' },
  { n: 'Бетис', l: 'La Liga', f: '🇪🇸' },
  { n: 'Валенсия', l: 'La Liga', f: '🇪🇸' },
  // Premier League
  { n: 'Манчестер Сити', l: 'Premier League', f: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', i: 'icons.cc/64x64/manchester-city.football-logos.cc.png' },
  { n: 'Арсенал', l: 'Premier League', f: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', i: 'icons.cc/64x64/arsenal.football-logos.cc.png' },
  { n: 'Ливерпуль', l: 'Premier League', f: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', i: 'icons.cc/64x64/liverpool.football-logos.cc.png' },
  { n: 'Челси', l: 'Premier League', f: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', i: 'icons.cc/64x64/chelsea.football-logos.cc.png' },
  { n: 'Манчестер Юнайтед', l: 'Premier League', f: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { n: 'Тоттенхэм', l: 'Premier League', f: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', i: 'icons.cc/64x64/tottenham.football-logos.cc.png' },
  { n: 'Ньюкасл', l: 'Premier League', f: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', i: 'icons.cc/64x64/newcastle.football-logos.cc.png' },
  { n: 'Астон Вилла', l: 'Premier League', f: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  // Serie A
  { n: 'Интер', l: 'Serie A', f: '🇮🇹', i: 'icons.cc/64x64/inter.football-logos.cc.png' },
  { n: 'Ювентус', l: 'Serie A', f: '🇮🇹', i: 'icons.cc/64x64/juventus.football-logos.cc.png' },
  { n: 'Милан', l: 'Serie A', f: '🇮🇹' },
  { n: 'Наполи', l: 'Serie A', f: '🇮🇹', i: 'icons.cc/64x64/napoli.football-logos.cc.png' },
  { n: 'Рома', l: 'Serie A', f: '🇮🇹' },
  { n: 'Лацио', l: 'Serie A', f: '🇮🇹' },
  { n: 'Аталанта', l: 'Serie A', f: '🇮🇹', i: 'icons.cc/64x64/atalanta.football-logos.cc.png' },
  { n: 'Фиорентина', l: 'Serie A', f: '🇮🇹' },
  // Bundesliga
  { n: 'Бавария', l: 'Bundesliga', f: '🇩🇪', i: 'icons.cc/64x64/bayern-munchen.football-logos.cc.png' },
  { n: 'Боруссия Дортмунд', l: 'Bundesliga', f: '🇩🇪', i: 'icons.cc/64x64/borussia-dortmund.football-logos.cc.png' },
  { n: 'Байер Леверкузен', l: 'Bundesliga', f: '🇩🇪', i: 'icons.cc/64x64/bayer-leverkusen.football-logos.cc.png' },
  { n: 'РБ Лейпциг', l: 'Bundesliga', f: '🇩🇪' },
  { n: 'Айнтрахт Франкфурт', l: 'Bundesliga', f: '🇩🇪', i: 'icons.cc/64x64/eintracht-frankfurt.football-logos.cc.png' },
  { n: 'Вольфсбург', l: 'Bundesliga', f: '🇩🇪' },
  // Ligue 1
  { n: 'ПСЖ', l: 'Ligue 1', f: '🇫🇷', i: 'icons.cc/64x64/paris-saint-germain.football-logos.cc.png' },
  { n: 'Монако', l: 'Ligue 1', f: '🇫🇷', i: 'icons.cc/64x64/as-monaco.football-logos.cc.png' },
  { n: 'Марсель', l: 'Ligue 1', f: '🇫🇷', i: 'icons.cc/64x64/marseille.football-logos.cc.png' },
  { n: 'Лион', l: 'Ligue 1', f: '🇫🇷' },
  { n: 'Лилль', l: 'Ligue 1', f: '🇫🇷' },
  // Eredivisie
  { n: 'Аякс', l: 'Eredivisie', f: '🇳🇱', i: 'icons.cc/64x64/ajax.football-logos.cc.png' },
  { n: 'ПСВ', l: 'Eredivisie', f: '🇳🇱', i: 'icons.cc/64x64/psv.football-logos.cc.png' },
  { n: 'Фейеноорд', l: 'Eredivisie', f: '🇳🇱' },
  // Португалия
  { n: 'Бенфика', l: 'Primeira Liga', f: '🇵🇹', i: 'icons.cc/64x64/benfica.football-logos.cc.png' },
  { n: 'Порту', l: 'Primeira Liga', f: '🇵🇹' },
  { n: 'Спортинг', l: 'Primeira Liga', f: '🇵🇹', i: 'icons.cc/64x64/sporting-cp.football-logos.cc.png' },
  // РПЛ
  { n: 'Зенит', l: 'РПЛ', f: '🇷🇺' },
  { n: 'ЦСКА', l: 'РПЛ', f: '🇷🇺' },
  { n: 'Спартак', l: 'РПЛ', f: '🇷🇺' },
  { n: 'Локомотив', l: 'РПЛ', f: '🇷🇺' },
  { n: 'Динамо Москва', l: 'РПЛ', f: '🇷🇺' },
  // Таджикистан
  { n: 'Истиклол', l: 'Лига ТФФ', f: '🇹🇯' },
  { n: 'Хукумат', l: 'Лига ТФФ', f: '🇹🇯' },
  { n: 'ЦСКА Душанбе', l: 'Лига ТФФ', f: '🇹🇯' },
];
