import { subscriptionStatus } from "./premium-access.js";

export const PREMIUM_COPY = {
  ru: {
    title: "CamAlert Premium",
    lead: "Навигация и предупреждения о камерах на время поездки.",
    benefits: [
      "Построение маршрута и ведение Google",
      "Голосовые подсказки поворотов",
      "Голос Yevheniia для камер Украины",
      "Предупреждения о камерах в других странах",
      "Настройки дистанции и предупреждений",
    ],
    periods: { week: "Неделя", month: "Месяц", year: "Год", lifetime: "Навсегда" },
    highlighted: "Годовой",
    trial: "3 дня без оплаты для новых пользователей, которым магазин разрешает пробный период. Дальше подписка продлевается сама, пока её не отменят.",
    charge: "CamAlert деньги не списывает. Оплату проводит Apple или Google.",
    continue: "Продолжить",
    back: "Назад",
    access: "Доступ действует до даты, которую сообщил магазин.",
    trialEnds: "Пробный период заканчивается",
    afterTrial: "После этой даты магазин продлевает подписку сам, если её не отменили.",
    restore: "Восстановить покупки",
    manage: "Управление подпиской",
    terms: "Условия использования",
    privacy: "Политика конфиденциальности",
    priceWait: "Цена появится из магазина",
    nextCharge: "Следующее списание",
    noRenew: "Дальше списаний нет",
    open: "CamAlert Premium",
    cardSubtitle: "Больше возможностей в каждой поездке",
    cardLifetime: "Активен навсегда ✓",
    cardActiveUntil: "Подписка активна до {date}",
    cardTrialUntil: "Пробный период до {date}",
    mySubscription: "Моя подписка",
    lifetimeStanding: "Активен",
    purchasedOn: "Дата покупки: {date}",
    sandboxNote: "Тестовая покупка",
    offerTitle: "Попробуйте Premium бесплатно",
    offerPlain: "Попробуйте CamAlert Premium",
    offerSub: "3 дня бесплатно с годовой подпиской",
    offerPlainSub: "Неделя, месяц, год или навсегда",
    yearTrial: "3 дня бесплатно, затем {price}/год",
    yearTerms: "{price} в год",
    weekTerms: "{price} в неделю",
    monthTerms: "{price} в месяц",
    lifeTerms: "{price}, один раз и без продления",
    tryFree: "Попробовать бесплатно",
    tryPlans: "Открыть тарифы",
    later: "Позже",
    rate: "Оценить CamAlert",
    ratePrompt: "Оцените CamAlert, если он полезен в дороге",
    rateNow: "Оценить",
    rateLater: "Не сейчас",
    distanceTitle: "Настройки дистанции и предупреждений",
    legacy: "Доступ из уже установленной версии сохраняется.",
    purchased: "Магазин подтвердил покупку.",
    restored: "Магазин вернул активные покупки.",
    noneRestored: "Активных покупок магазин не нашёл.",
    cancelled: "Покупка отменена.",
    revoked: "Магазин вернул оплату по этой покупке.",
    expired: "Срок этой покупки закончился.",
    storeUnavailable: "Магазин сейчас не ответил. Покупка не прошла.",
    lifetimeActive: "Premium навсегда активен",
    lifetimeTitle: "CamAlert Premium навсегда",
    lifetimeOnce: "Разовая покупка. Без продления",
    statusActive: "Подписка активна",
    statusTrial: "Пробный период",
    statusRenewalCancelled: "Продление отменено",
    statusExpired: "Подписка истекла",
    statusRevoked: "Оплата возвращена",
    accessUntil: "Доступ до {date}",
    renewsOn: "Продление {date}",
    restoredWith: "Покупки восстановлены",
    noneFound: "Активных покупок не найдено",
    restoreFailed: "Не удалось проверить покупки. Повторите попытку",
    redeemCode: "Активировать промокод",
    redeemUnchanged: "Магазин не подтвердил новую покупку",
    purchasePending: "Покупка обрабатывается",
    purchaseUnverified: "Не удалось проверить покупку. Повторите попытку",
    purchaseCancelled: "Покупка не завершена",
    rateSettings: "Оценить приложение",
    rateFailed: "Не удалось открыть страницу отзыва.",
    checking: "Проверяем покупки…",
    diagTitle: "Счётчики предложений",
    diagLaunches: "Запуски",
    diagTrips: "Завершённые поездки",
    diagPremium: "Premium",
    diagReview: "Оценка",
    reasonMoving: "Скрыто во время поездки",
    reasonNavigation: "Скрыто, пока открыт экран навигации",
    reasonBlocked: "Скрыто, пока открыто другое окно",
    reasonAccess: "Уже есть доступ, покупку не предлагаем",
    reasonSettled: "Уже показано или закрыто",
    reasonWaiting: "Ещё рано: запусков {launches} из 5, поездок {trips} из 5",
    reasonReviewWaiting: "Ещё рано: запусков {launches} из 10, поездок {trips} из 10",
    reasonReady: "Можно показать",
    reasonHidden: "Условия выполнены, но показ отложен",
  },
  uk: {
    title: "CamAlert Premium",
    lead: "Навігація і попередження про камери на час поїздки.",
    benefits: [
      "Побудова маршруту і ведення Google",
      "Голосові підказки поворотів",
      "Голос Yevheniia для камер України",
      "Попередження про камери в інших країнах",
      "Налаштування дистанції і попереджень",
    ],
    periods: { week: "Тиждень", month: "Місяць", year: "Рік", lifetime: "Назавжди" },
    highlighted: "Річний",
    trial: "3 дні без оплати для нових користувачів, яким магазин дозволяє пробний період. Далі підписка поновлюється сама, поки її не скасують.",
    charge: "CamAlert гроші не списує. Оплату проводить Apple або Google.",
    continue: "Продовжити",
    back: "Назад",
    access: "Доступ діє до дати, яку повідомив магазин.",
    trialEnds: "Пробний період закінчується",
    afterTrial: "Після цієї дати магазин поновлює підписку сам, якщо її не скасували.",
    restore: "Відновити покупки",
    manage: "Керування підпискою",
    terms: "Умови використання",
    privacy: "Політика конфіденційності",
    priceWait: "Ціна з’явиться з магазину",
    nextCharge: "Наступне списання",
    noRenew: "Далі списань немає",
    open: "CamAlert Premium",
    cardSubtitle: "Більше можливостей у кожній поїздці",
    cardLifetime: "Активний назавжди ✓",
    cardActiveUntil: "Підписка активна до {date}",
    cardTrialUntil: "Пробний період до {date}",
    mySubscription: "Моя підписка",
    lifetimeStanding: "Активний",
    purchasedOn: "Дата покупки: {date}",
    sandboxNote: "Тестова покупка",
    offerTitle: "Спробуйте Premium безкоштовно",
    offerPlain: "Спробуйте CamAlert Premium",
    offerSub: "3 дні безкоштовно з річною підпискою",
    offerPlainSub: "Тиждень, місяць, рік або назавжди",
    yearTrial: "3 дні безкоштовно, далі {price}/рік",
    yearTerms: "{price} на рік",
    weekTerms: "{price} на тиждень",
    monthTerms: "{price} на місяць",
    lifeTerms: "{price}, один раз і без поновлення",
    tryFree: "Спробувати безкоштовно",
    tryPlans: "Відкрити тарифи",
    later: "Пізніше",
    rate: "Оцінити CamAlert",
    ratePrompt: "Оцініть CamAlert, якщо він корисний у дорозі",
    rateNow: "Оцінити",
    rateLater: "Не зараз",
    distanceTitle: "Налаштування дистанції і попереджень",
    legacy: "Доступ із уже встановленої версії зберігається.",
    purchased: "Магазин підтвердив покупку.",
    restored: "Магазин повернув активні покупки.",
    noneRestored: "Активних покупок магазин не знайшов.",
    cancelled: "Покупку скасовано.",
    revoked: "Магазин повернув оплату за цю покупку.",
    expired: "Строк цієї покупки закінчився.",
    storeUnavailable: "Магазин зараз не відповів. Покупка не пройшла.",
    lifetimeActive: "Premium назавжди активний",
    lifetimeTitle: "CamAlert Premium назавжди",
    lifetimeOnce: "Разова покупка. Без продовження.",
    statusActive: "Підписка активна",
    statusTrial: "Пробний період",
    statusRenewalCancelled: "Продовження скасовано",
    statusExpired: "Підписка закінчилась",
    statusRevoked: "Оплату повернено",
    accessUntil: "Доступ до {date}",
    renewsOn: "Продовження {date}",
    restoredWith: "Покупки відновлено",
    noneFound: "Активних покупок не знайдено",
    restoreFailed: "Не вдалося перевірити покупки. Спробуйте ще раз",
    redeemCode: "Активувати промокод",
    redeemUnchanged: "Магазин не підтвердив нову покупку",
    purchasePending: "Покупка обробляється",
    purchaseUnverified: "Не вдалося перевірити покупку. Спробуйте ще раз",
    purchaseCancelled: "Покупку не завершено",
    rateSettings: "Оцінити застосунок",
    rateFailed: "Не вдалося відкрити сторінку відгуку.",
    checking: "Перевіряємо покупки…",
    diagTitle: "Лічильники пропозицій",
    diagLaunches: "Запуски",
    diagTrips: "Завершені поїздки",
    diagPremium: "Premium",
    diagReview: "Оцінка",
    reasonMoving: "Сховано під час поїздки",
    reasonNavigation: "Сховано, поки відкритий екран навігації",
    reasonBlocked: "Сховано, поки відкрите інше вікно",
    reasonAccess: "Доступ уже є, покупку не пропонуємо",
    reasonSettled: "Уже показано або закрито",
    reasonWaiting: "Ще рано: запусків {launches} з 5, поїздок {trips} з 5",
    reasonReviewWaiting: "Ще рано: запусків {launches} з 10, поїздок {trips} з 10",
    reasonReady: "Можна показати",
    reasonHidden: "Умови виконані, але показ відкладено",
  },
  en: {
    title: "CamAlert Premium",
    lead: "Navigation and camera warnings for the drive.",
    benefits: [
      "Google route building and guidance",
      "Spoken turn prompts",
      "Yevheniia for cameras in Ukraine",
      "Camera warnings in other countries",
      "Warning distance and alert settings",
    ],
    periods: { week: "Week", month: "Month", year: "Year", lifetime: "Lifetime" },
    highlighted: "Yearly",
    trial: "3 days without payment for new users the store allows to start a trial. The subscription then renews on its own until it is cancelled.",
    charge: "CamAlert does not charge you. Apple or Google takes the payment.",
    continue: "Continue",
    back: "Back",
    access: "Access lasts until the date the store reports.",
    trialEnds: "The trial ends",
    afterTrial: "After that date the store renews the subscription on its own unless it is cancelled.",
    restore: "Restore purchases",
    manage: "Manage subscription",
    terms: "Terms of use",
    privacy: "Privacy policy",
    priceWait: "The price comes from the store",
    nextCharge: "Next charge",
    noRenew: "No further charges",
    open: "CamAlert Premium",
    cardSubtitle: "More in every drive",
    cardLifetime: "Active forever ✓",
    cardActiveUntil: "Subscription active until {date}",
    cardTrialUntil: "Free trial until {date}",
    mySubscription: "My subscription",
    lifetimeStanding: "Active",
    purchasedOn: "Purchase date: {date}",
    sandboxNote: "Test purchase",
    offerTitle: "Try Premium free",
    offerPlain: "Try CamAlert Premium",
    offerSub: "3 days free with the yearly plan",
    offerPlainSub: "Week, month, year, or lifetime",
    yearTrial: "3 days free, then {price}/year",
    yearTerms: "{price} per year",
    weekTerms: "{price} per week",
    monthTerms: "{price} per month",
    lifeTerms: "{price}, once, with no renewal",
    tryFree: "Try free",
    tryPlans: "See the plans",
    later: "Later",
    rate: "Rate CamAlert",
    ratePrompt: "Rate CamAlert if it helps on the road",
    rateNow: "Rate",
    rateLater: "Not now",
    distanceTitle: "Warning distance and alert settings",
    legacy: "Access from the version already installed stays.",
    purchased: "The store confirmed the purchase.",
    restored: "The store returned the active purchases.",
    noneRestored: "The store found no active purchase.",
    cancelled: "The purchase was cancelled.",
    revoked: "The store refunded this purchase.",
    expired: "This purchase has expired.",
    storeUnavailable: "The store did not answer. The purchase did not go through.",
    lifetimeActive: "Premium forever is active",
    lifetimeTitle: "CamAlert Premium forever",
    lifetimeOnce: "One-time purchase. No renewal.",
    statusActive: "Subscription active",
    statusTrial: "Trial",
    statusRenewalCancelled: "Renewal cancelled",
    statusExpired: "Subscription expired",
    statusRevoked: "Payment refunded",
    accessUntil: "Access until {date}",
    renewsOn: "Renews {date}",
    restoredWith: "Purchases restored",
    noneFound: "No active purchases found",
    restoreFailed: "Couldn't verify purchases. Try again",
    redeemCode: "Redeem offer code",
    redeemUnchanged: "The store did not confirm a new purchase",
    purchasePending: "The purchase is processing",
    purchaseUnverified: "Couldn't verify the purchase. Try again",
    purchaseCancelled: "The purchase was not completed",
    rateSettings: "Rate the app",
    rateFailed: "The review page could not be opened.",
    checking: "Checking purchases…",
    diagTitle: "Offer counters",
    diagLaunches: "Launches",
    diagTrips: "Finished trips",
    diagPremium: "Premium",
    diagReview: "Rating",
    reasonMoving: "Hidden during a trip",
    reasonNavigation: "Hidden while navigation is open",
    reasonBlocked: "Hidden while another window is open",
    reasonAccess: "Access is already active, so no offer",
    reasonSettled: "Already shown or dismissed",
    reasonWaiting: "Not yet: {launches} of 5 launches, {trips} of 5 trips",
    reasonReviewWaiting: "Not yet: {launches} of 10 launches, {trips} of 10 trips",
    reasonReady: "Ready to show",
    reasonHidden: "The count is reached, and the offer is waiting",
  },
  pl: {
    title: "CamAlert Premium",
    lead: "Nawigacja i ostrzeżenia o kamerach na czas jazdy.",
    benefits: [
      "Wyznaczanie trasy i prowadzenie Google",
      "Głosowe wskazówki skrętów",
      "Yevheniia dla kamer w Ukrainie",
      "Ostrzeżenia o kamerach w innych krajach",
      "Ustawienia odległości i ostrzeżeń",
    ],
    periods: { week: "Tydzień", month: "Miesiąc", year: "Rok", lifetime: "Na zawsze" },
    highlighted: "Roczny",
    trial: "3 dni bez opłaty dla nowych użytkowników, którym sklep pozwala rozpocząć okres próbny. Potem subskrypcja przedłuża się sama, dopóki nie zostanie anulowana.",
    charge: "CamAlert nie pobiera pieniędzy. Płatność realizuje Apple lub Google.",
    continue: "Kontynuuj",
    back: "Wstecz",
    access: "Dostęp trwa do daty podanej przez sklep.",
    trialEnds: "Okres próbny kończy się",
    afterTrial: "Po tej dacie sklep przedłuża subskrypcję sam, jeśli nie zostanie anulowana.",
    restore: "Przywróć zakupy",
    manage: "Zarządzaj subskrypcją",
    terms: "Warunki użytkowania",
    privacy: "Polityka prywatności",
    priceWait: "Cena pojawi się ze sklepu",
    nextCharge: "Następne obciążenie",
    noRenew: "Kolejnych obciążeń nie będzie",
    open: "CamAlert Premium",
    cardSubtitle: "Więcej możliwości w każdej jeździe",
    cardLifetime: "Aktywny na zawsze ✓",
    cardActiveUntil: "Subskrypcja aktywna do {date}",
    cardTrialUntil: "Okres próbny do {date}",
    mySubscription: "Moja subskrypcja",
    lifetimeStanding: "Aktywny",
    purchasedOn: "Data zakupu: {date}",
    sandboxNote: "Zakup testowy",
    offerTitle: "Wypróbuj Premium za darmo",
    offerPlain: "Wypróbuj CamAlert Premium",
    offerSub: "3 dni za darmo z planem rocznym",
    offerPlainSub: "Tydzień, miesiąc, rok albo na zawsze",
    yearTrial: "3 dni za darmo, potem {price}/rok",
    yearTerms: "{price} rocznie",
    weekTerms: "{price} tygodniowo",
    monthTerms: "{price} miesięcznie",
    lifeTerms: "{price}, jednorazowo, bez odnowienia",
    tryFree: "Wypróbuj za darmo",
    tryPlans: "Zobacz plany",
    later: "Później",
    rate: "Oceń CamAlert",
    ratePrompt: "Oceń CamAlert, jeśli pomaga w drodze",
    rateNow: "Oceń",
    rateLater: "Nie teraz",
    distanceTitle: "Ustawienia odległości i ostrzeżeń",
    legacy: "Dostęp z już zainstalowanej wersji zostaje.",
    purchased: "Sklep potwierdził zakup.",
    restored: "Sklep zwrócił aktywne zakupy.",
    noneRestored: "Sklep nie znalazł aktywnego zakupu.",
    cancelled: "Zakup został anulowany.",
    revoked: "Sklep zwrócił płatność za ten zakup.",
    expired: "Okres tego zakupu minął.",
    storeUnavailable: "Sklep teraz nie odpowiedział. Zakup nie przeszedł.",
    lifetimeActive: "Premium na zawsze jest aktywne",
    lifetimeTitle: "CamAlert Premium na zawsze",
    lifetimeOnce: "Zakup jednorazowy. Bez odnowienia.",
    statusActive: "Subskrypcja aktywna",
    statusTrial: "Okres próbny",
    statusRenewalCancelled: "Odnowienie anulowane",
    statusExpired: "Subskrypcja wygasła",
    statusRevoked: "Płatność zwrócona",
    accessUntil: "Dostęp do {date}",
    renewsOn: "Odnowienie {date}",
    restoredWith: "Zakupy przywrócone",
    noneFound: "Nie znaleziono aktywnych zakupów",
    restoreFailed: "Nie udało się sprawdzić zakupów. Spróbuj ponownie",
    redeemCode: "Aktywuj kod promocyjny",
    redeemUnchanged: "Sklep nie potwierdził nowego zakupu",
    purchasePending: "Zakup jest przetwarzany",
    purchaseUnverified: "Nie udało się sprawdzić zakupu. Spróbuj ponownie",
    purchaseCancelled: "Zakupu nie dokończono",
    rateSettings: "Oceń aplikację",
    rateFailed: "Nie udało się otworzyć strony opinii.",
    checking: "Sprawdzamy zakupy…",
    diagTitle: "Liczniki propozycji",
    diagLaunches: "Uruchomienia",
    diagTrips: "Zakończone trasy",
    diagPremium: "Premium",
    diagReview: "Ocena",
    reasonMoving: "Ukryte podczas jazdy",
    reasonNavigation: "Ukryte, gdy nawigacja jest otwarta",
    reasonBlocked: "Ukryte, gdy otwarte jest inne okno",
    reasonAccess: "Dostęp już jest, więc bez propozycji",
    reasonSettled: "Już pokazane albo zamknięte",
    reasonWaiting: "Jeszcze nie: uruchomień {launches} z 5, tras {trips} z 5",
    reasonReviewWaiting: "Jeszcze nie: uruchomień {launches} z 10, tras {trips} z 10",
    reasonReady: "Można pokazać",
    reasonHidden: "Licznik osiągnięty, propozycja czeka",
  },
};

export function premiumCopy(language) {
  return PREMIUM_COPY[language] || PREMIUM_COPY.ru;
}

function withPrice(template, price) {
  return template.split("{price}").join(price);
}

function fillCounts(template, launches, trips) {
  return template.split("{launches}").join(String(launches)).split("{trips}").join(String(trips));
}

function hideText(decision, copy) {
  if (decision.hide === "moving") return copy.reasonMoving;
  if (decision.hide === "navigation") return copy.reasonNavigation;
  if (decision.hide === "blocked") return copy.reasonBlocked;
  return null;
}

export function offerReasonLines(decision, copy) {
  const hidden = hideText(decision, copy);
  const premiumDue = decision.launchPremiumDue || decision.tripPremiumDue;
  const reviewDue = decision.launchReviewDue || decision.tripReviewDue;
  let premium;
  if (decision.hasPremium) premium = copy.reasonAccess;
  else if (hidden && premiumDue) premium = hidden;
  else if (decision.kind === "premium") premium = copy.reasonReady;
  else if (!premiumDue && decision.trips < 5) premium = fillCounts(copy.reasonWaiting, decision.launches, decision.trips);
  else if (!premiumDue) premium = copy.reasonSettled;
  else premium = copy.reasonHidden;
  let review;
  if (hidden && reviewDue && decision.kind !== "premium") review = hidden;
  else if (decision.kind === "review") review = copy.reasonReady;
  else if (decision.kind === "premium" && reviewDue) review = copy.reasonHidden;
  else if (!reviewDue && decision.trips < 10 && decision.launches < 10) review = fillCounts(copy.reasonReviewWaiting, decision.launches, decision.trips);
  else if (!reviewDue) review = copy.reasonSettled;
  else review = copy.reasonHidden;
  return [
    `${copy.diagLaunches}: ${decision.launches}`,
    `${copy.diagTrips}: ${decision.trips}`,
    `${copy.diagPremium}: ${premium}`,
    `${copy.diagReview}: ${review}`,
  ];
}

// The price string comes from the store. A missing price is not replaced
// with a fixed dollar amount. Free days are named only for the yearly plan
// when the store says this person can start the introductory offer.
export function selectedPlanTerms({ period, price, trialEligible, copy }) {
  const label = typeof price === "string" ? price.trim() : "";
  if (!label) return copy.priceWait;
  if (period === "year" && trialEligible === true) return withPrice(copy.yearTrial, label);
  if (period === "year") return withPrice(copy.yearTerms, label);
  if (period === "month") return withPrice(copy.monthTerms, label);
  if (period === "week") return withPrice(copy.weekTerms, label);
  return withPrice(copy.lifeTerms, label);
}

function dated(template, value) {
  if (!Number.isFinite(Number(value))) return "";
  return template.split("{date}").join(new Date(Number(value)).toLocaleDateString());
}

// The settings card follows a verified entitlement. A missing date stays off
// the card. An active purchase opens the subscription page; anything else
// opens the plans.
export function settingsCardCopy(entitlement, language, now = Date.now()) {
  const copy = premiumCopy(language);
  const status = subscriptionStatus(entitlement, now);
  if (status?.code === "lifetime") {
    return { title: copy.open, subtitle: copy.cardLifetime, open: "manage" };
  }
  if (status?.code === "trial" && Number.isFinite(status.endsAt)) {
    return { title: copy.open, subtitle: dated(copy.cardTrialUntil, status.endsAt), open: "manage" };
  }
  const until = status?.renewsAt || status?.endsAt;
  if ((status?.code === "active" || status?.code === "renewal-cancelled") && Number.isFinite(until)) {
    return { title: copy.open, subtitle: dated(copy.cardActiveUntil, until), open: "manage" };
  }
  return { title: copy.open, subtitle: copy.cardSubtitle, open: "plans" };
}

function extraLines(entitlement, copy) {
  const lines = [];
  const bought = dated(copy.purchasedOn, entitlement?.purchaseDate);
  if (bought) lines.push(bought);
  if (entitlement?.environment === "sandbox") lines.push(copy.sandboxNote);
  return lines;
}

export function statusLines(entitlement, language, now = Date.now()) {
  const copy = premiumCopy(language);
  const status = subscriptionStatus(entitlement, now);
  if (!status) return null;
  const period = entitlement?.period && copy.periods[entitlement.period] ? copy.periods[entitlement.period] : "";
  const price = typeof entitlement?.displayPrice === "string" ? entitlement.displayPrice : "";
  if (status.code === "lifetime") {
    return {
      title: copy.mySubscription,
      lines: [copy.lifetimeTitle, copy.lifetimeStanding, copy.lifetimeOnce, ...extraLines(entitlement, copy)].filter(Boolean),
      manage: false,
    };
  }
  const title = {
    active: copy.statusActive,
    trial: copy.statusTrial,
    "renewal-cancelled": copy.statusRenewalCancelled,
    expired: copy.statusExpired,
    revoked: copy.statusRevoked,
  }[status.code] || "";
  const lines = [];
  if (period) lines.push(period);
  if (price) lines.push(price);
  if (status.renewsAt) lines.push(dated(copy.renewsOn, status.renewsAt));
  else if (status.endsAt) lines.push(dated(copy.accessUntil, status.endsAt));
  lines.push(...extraLines(entitlement, copy));
  return { title: copy.mySubscription, lines: [title, ...lines].filter(Boolean), manage: true };
}
