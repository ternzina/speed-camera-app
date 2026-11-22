import StoreKit
import UIKit

/// The iOS PRO screen from premium-screen.js. The road photograph is the
/// original assets/pro-evening-road.png. Slide marks follow premium-pro-art.js.
final class PremiumViewController: UIViewController {
  private let evening = UIColor(red: 8 / 255, green: 15 / 255, blue: 41 / 255, alpha: 1)
  private let gold = UIColor(red: 255 / 255, green: 198 / 255, blue: 41 / 255, alpha: 1)
  private let cream = UIColor(red: 246 / 255, green: 244 / 255, blue: 241 / 255, alpha: 1)
  private let headlineColor = UIColor(red: 255 / 255, green: 229 / 255, blue: 154 / 255, alpha: 1)
  private let slides: [(id: String, title: String, text: String)] = [
    ("cameras", "Камеры", "Предупреждение до камеры, на экране и голосом."),
    ("navigation", "Навигация", "Маршрут и ведение по дороге."),
    ("voice", "Голос", "Повороты и камеры произносятся вслух."),
    ("background", "Фон", "Предупреждения идут и при погашенном экране."),
    ("settings", "Настройки", "Дистанция, звуки и оформление поездки."),
  ]
  private var products: [Product] = []
  private var selected = "camalert_premium_yearly"
  private let planRow = UIStackView()
  private let terms = UILabel()
  private let note = UILabel()
  private let stage = UIScrollView()
  private let dots = UIStackView()
  private var cardWidth: CGFloat = 280
  private var topGap: NSLayoutConstraint?
  private var stagePage = 0
  private var stageTimer: Timer?
  private var carouselLinked = false

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = evening
    let scroll = UIScrollView()
    scroll.translatesAutoresizingMaskIntoConstraints = false
    scroll.alwaysBounceVertical = true
    scroll.contentInsetAdjustmentBehavior = .never
    let stack = UIStackView()
    stack.axis = .vertical
    stack.spacing = 7
    stack.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(scroll)
    scroll.addSubview(stack)
    NSLayoutConstraint.activate([
      scroll.topAnchor.constraint(equalTo: view.topAnchor),
      scroll.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      scroll.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      scroll.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      stack.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor),
      stack.leadingAnchor.constraint(equalTo: scroll.frameLayoutGuide.leadingAnchor, constant: 16),
      stack.trailingAnchor.constraint(equalTo: scroll.frameLayoutGuide.trailingAnchor, constant: -16),
      stack.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor, constant: -18),
      stack.widthAnchor.constraint(equalTo: scroll.frameLayoutGuide.widthAnchor, constant: -32),
    ])
    let gap = UIView()
    gap.translatesAutoresizingMaskIntoConstraints = false
    let gapHeight = gap.heightAnchor.constraint(equalToConstant: 59)
    gapHeight.isActive = true
    topGap = gapHeight
    stack.addArrangedSubview(gap)
    stack.setCustomSpacing(0, after: gap)
    stack.addArrangedSubview(hero())
    stack.addArrangedSubview(stageFrame())
    planRow.axis = .horizontal
    planRow.spacing = 6
    planRow.distribution = .fillEqually
    stack.addArrangedSubview(planRow)
    terms.numberOfLines = 0
    terms.textAlignment = .center
    terms.textColor = cream
    terms.font = .camalert(13, weight: .semibold)
    stack.addArrangedSubview(terms)
    note.numberOfLines = 0
    note.textAlignment = .center
    note.textColor = UIColor(red: 213 / 255, green: 217 / 255, blue: 232 / 255, alpha: 1)
    note.font = .camalert(11)
    note.text = ""
    stack.addArrangedSubview(note)
    stack.addArrangedSubview(unlockButton())
    let charge = UILabel()
    charge.text = "CamAlert деньги не списывает. Оплату проводит Apple или Google."
    charge.textColor = UIColor(red: 197 / 255, green: 203 / 255, blue: 222 / 255, alpha: 1)
    charge.font = .camalert(11)
    charge.textAlignment = .center
    charge.numberOfLines = 0
    stack.addArrangedSubview(charge)
    stack.addArrangedSubview(utilityRow())
    stack.addArrangedSubview(link("Управление подпиской", action: #selector(manage)))
    stack.addArrangedSubview(legalRow())
    showPlans(prices: [:])
    Task { await loadProducts() }
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    navigationController?.setNavigationBarHidden(true, animated: animated)
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    if !carouselLinked, let outer = view.subviews.first as? UIScrollView {
      outer.panGestureRecognizer.require(toFail: stage.panGestureRecognizer)
      carouselLinked = true
    }
    if cardWidth > 0, stage.subviews.isEmpty { layoutCards() }
    stageTimer?.invalidate()
    stageTimer = Timer.scheduledTimer(withTimeInterval: 4.5, repeats: true) { [weak self] _ in
      self?.advanceStage()
    }
  }

  override func viewWillDisappear(_ animated: Bool) {
    super.viewWillDisappear(animated)
    stageTimer?.invalidate()
  }

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    topGap?.constant = view.safeAreaInsets.top
    let width = max(230, stage.bounds.width - 62)
    guard abs(width - cardWidth) > 1, stage.bounds.width > 0 else { return }
    cardWidth = width
    layoutCards()
  }

  private func hero() -> UIView {
    let image = UIImageView(image: UIImage(named: "pro-evening-road"))
    image.contentMode = .scaleAspectFill
    image.clipsToBounds = true
    image.translatesAutoresizingMaskIntoConstraints = false
    image.heightAnchor.constraint(equalToConstant: 184).isActive = true
    let shade = UIView()
    shade.backgroundColor = UIColor(red: 4 / 255, green: 10 / 255, blue: 31 / 255, alpha: 0.24)
    shade.translatesAutoresizingMaskIntoConstraints = false
    image.isUserInteractionEnabled = true
    let close = UIButton(type: .system)
    close.setTitle("×", for: .normal)
    close.setTitleColor(cream, for: .normal)
    close.titleLabel?.font = .camalert(28, weight: .light)
    close.layer.cornerRadius = 22
    close.layer.borderWidth = 1
    close.layer.borderColor = UIColor(white: 1, alpha: 0.45).cgColor
    close.backgroundColor = UIColor(red: 6 / 255, green: 12 / 255, blue: 34 / 255, alpha: 0.55)
    close.addTarget(self, action: #selector(goBack), for: .touchUpInside)
    close.translatesAutoresizingMaskIntoConstraints = false
    let camera = cameraMark()
    let logo = UILabel()
    logo.text = "CamAlert"
    logo.textColor = cream
    logo.font = .camalert(23, weight: .heavy)
    let pro = UILabel()
    pro.text = " PRO "
    pro.textColor = UIColor(red: 9 / 255, green: 14 / 255, blue: 35 / 255, alpha: 1)
    pro.backgroundColor = gold
    pro.font = .camalert(18, weight: .black)
    pro.layer.cornerRadius = 12
    pro.clipsToBounds = true
    let brand = UIStackView(arrangedSubviews: [camera, logo, pro])
    brand.axis = .horizontal
    brand.alignment = .center
    brand.spacing = 7
    let title = UILabel()
    title.text = "Штрафы в прошлом"
    title.textColor = headlineColor
    title.font = .italicSystemFont(ofSize: 28).withWeight(.black)
    title.textAlignment = .center
    title.numberOfLines = 2
    let swoosh = UIView()
    swoosh.backgroundColor = gold
    swoosh.layer.cornerRadius = 2
    swoosh.transform = CGAffineTransform(rotationAngle: -3 * .pi / 180)
    swoosh.translatesAutoresizingMaskIntoConstraints = false
    swoosh.heightAnchor.constraint(equalToConstant: 4).isActive = true
    let lead = UILabel()
    lead.text = "Предупреждения о камерах, удобная навигация и уверенность в дороге."
    lead.textColor = cream
    lead.font = .camalert(14, weight: .medium)
    lead.textAlignment = .center
    lead.numberOfLines = 2
    let column = UIStackView(arrangedSubviews: [brand, title, swoosh, lead])
    column.axis = .vertical
    column.alignment = .center
    column.spacing = 6
    column.translatesAutoresizingMaskIntoConstraints = false
    column.isUserInteractionEnabled = false
    image.addSubview(shade)
    image.addSubview(column)
    NSLayoutConstraint.activate([
      shade.topAnchor.constraint(equalTo: image.topAnchor),
      shade.leadingAnchor.constraint(equalTo: image.leadingAnchor),
      shade.trailingAnchor.constraint(equalTo: image.trailingAnchor),
      shade.bottomAnchor.constraint(equalTo: image.bottomAnchor),
      column.centerXAnchor.constraint(equalTo: image.centerXAnchor),
      column.topAnchor.constraint(equalTo: image.topAnchor, constant: 15),
      column.leadingAnchor.constraint(greaterThanOrEqualTo: image.leadingAnchor, constant: 24),
      column.trailingAnchor.constraint(lessThanOrEqualTo: image.trailingAnchor, constant: -24),
      swoosh.widthAnchor.constraint(equalToConstant: 180),
    ])
    let wrap = UIView()
    wrap.translatesAutoresizingMaskIntoConstraints = false
    wrap.addSubview(image)
    wrap.addSubview(close)
    NSLayoutConstraint.activate([
      image.topAnchor.constraint(equalTo: wrap.topAnchor),
      image.leadingAnchor.constraint(equalTo: wrap.leadingAnchor, constant: -16),
      image.trailingAnchor.constraint(equalTo: wrap.trailingAnchor, constant: 16),
      image.bottomAnchor.constraint(equalTo: wrap.bottomAnchor),
      close.topAnchor.constraint(equalTo: wrap.topAnchor, constant: 8),
      close.leadingAnchor.constraint(equalTo: wrap.leadingAnchor, constant: -2),
      close.widthAnchor.constraint(equalToConstant: 44),
      close.heightAnchor.constraint(equalToConstant: 44),
    ])
    return wrap
  }

  private func cameraMark() -> UIView {
    let box = UIView()
    box.translatesAutoresizingMaskIntoConstraints = false
    box.widthAnchor.constraint(equalToConstant: 31).isActive = true
    box.heightAnchor.constraint(equalToConstant: 28).isActive = true
    box.layer.cornerRadius = 8
    box.layer.borderWidth = 2
    box.layer.borderColor = gold.cgColor
    box.backgroundColor = UIColor(red: 8 / 255, green: 15 / 255, blue: 41 / 255, alpha: 0.7)
    let lens = UIView()
    lens.translatesAutoresizingMaskIntoConstraints = false
    lens.layer.cornerRadius = 6
    lens.layer.borderWidth = 3
    lens.layer.borderColor = gold.cgColor
    box.addSubview(lens)
    NSLayoutConstraint.activate([
      lens.centerXAnchor.constraint(equalTo: box.centerXAnchor),
      lens.centerYAnchor.constraint(equalTo: box.centerYAnchor),
      lens.widthAnchor.constraint(equalToConstant: 12),
      lens.heightAnchor.constraint(equalToConstant: 12),
    ])
    return box
  }

  private func stageFrame() -> UIView {
    let frame = UIView()
    frame.backgroundColor = UIColor(red: 31 / 255, green: 20 / 255, blue: 72 / 255, alpha: 0.64)
    frame.layer.borderWidth = 1
    frame.layer.borderColor = UIColor(red: 111 / 255, green: 48 / 255, blue: 197 / 255, alpha: 0.9).cgColor
    frame.translatesAutoresizingMaskIntoConstraints = false
    frame.heightAnchor.constraint(equalToConstant: 190).isActive = true
    stage.showsHorizontalScrollIndicator = false
    stage.alwaysBounceHorizontal = true
    stage.isDirectionalLockEnabled = true
    stage.delegate = self
    stage.translatesAutoresizingMaskIntoConstraints = false
    dots.axis = .horizontal
    dots.spacing = 8
    dots.translatesAutoresizingMaskIntoConstraints = false
    frame.addSubview(stage)
    frame.addSubview(dots)
    NSLayoutConstraint.activate([
      stage.topAnchor.constraint(equalTo: frame.topAnchor, constant: 6),
      stage.leadingAnchor.constraint(equalTo: frame.leadingAnchor, constant: -16),
      stage.trailingAnchor.constraint(equalTo: frame.trailingAnchor, constant: 16),
      stage.bottomAnchor.constraint(equalTo: frame.bottomAnchor, constant: -6),
      dots.centerXAnchor.constraint(equalTo: frame.centerXAnchor),
      dots.bottomAnchor.constraint(equalTo: frame.bottomAnchor, constant: -2),
    ])
    for index in slides.indices {
      let dot = UIView()
      dot.tag = index
      dot.backgroundColor = index == 0 ? gold : UIColor(white: 1, alpha: 0.35)
      dot.layer.cornerRadius = 4
      dot.translatesAutoresizingMaskIntoConstraints = false
      dot.widthAnchor.constraint(equalToConstant: index == 0 ? 18 : 8).isActive = true
      dot.heightAnchor.constraint(equalToConstant: 8).isActive = true
      dots.addArrangedSubview(dot)
    }
    return frame
  }

  private func layoutCards() {
    stage.subviews.forEach { $0.removeFromSuperview() }
    var x: CGFloat = 16
    for slide in slides {
      let card = ProSlideCard(slide: slide, photo: UIImage(named: "pro-evening-road"), gold: gold, cream: cream)
      card.frame = CGRect(x: x, y: 8, width: cardWidth, height: 166)
      stage.addSubview(card)
      x += cardWidth + 12
    }
    stage.contentSize = CGSize(width: x + 4, height: 178)
  }

  private func unlockButton() -> UIButton {
    let button = UIButton(type: .system)
    button.setTitle("Разблокировать PRO  ›", for: .normal)
    button.setTitleColor(UIColor(red: 17 / 255, green: 16 / 255, blue: 26 / 255, alpha: 1), for: .normal)
    button.titleLabel?.font = .camalert(18, weight: .black)
    button.backgroundColor = gold
    button.layer.cornerRadius = 25
    button.layer.borderWidth = 1
    button.layer.borderColor = UIColor(red: 255 / 255, green: 228 / 255, blue: 125 / 255, alpha: 1).cgColor
    button.heightAnchor.constraint(equalToConstant: 50).isActive = true
    button.addTarget(self, action: #selector(buySelected), for: .touchUpInside)
    return button
  }

  private func utilityRow() -> UIView {
    let restore = link("↻  Восстановить покупки", action: #selector(restorePurchases))
    return restore
  }

  private func legalRow() -> UIView {
    let row = UIStackView(arrangedSubviews: [
      textLink("Условия использования", "https://camera.21wek.com/"),
      textLink("Политика конфиденциальности", "https://camera.21wek.com/privacy.html"),
    ])
    row.axis = .horizontal
    row.distribution = .fillEqually
    return row
  }

  private func link(_ title: String, action: Selector) -> UIButton {
    let button = UIButton(type: .system)
    button.setTitle(title, for: .normal)
    button.setTitleColor(cream, for: .normal)
    button.titleLabel?.font = .camalert(13, weight: .semibold)
    button.addTarget(self, action: action, for: .touchUpInside)
    button.heightAnchor.constraint(equalToConstant: 32).isActive = true
    return button
  }

  private func textLink(_ title: String, _ url: String) -> UIButton {
    let button = UIButton(type: .system)
    let text = NSAttributedString(string: title, attributes: [
      .underlineStyle: NSUnderlineStyle.single.rawValue,
      .foregroundColor: UIColor(red: 213 / 255, green: 217 / 255, blue: 232 / 255, alpha: 1),
      .font: UIFont.camalert(11),
    ])
    button.setAttributedTitle(text, for: .normal)
    button.addAction(UIAction { _ in
      if let url = URL(string: url) { UIApplication.shared.open(url) }
    }, for: .touchUpInside)
    return button
  }

  private func showPlans(prices: [String: String]) {
    planRow.arrangedSubviews.forEach { $0.removeFromSuperview() }
    let names = [
      "camalert_premium_weekly": "Неделя",
      "camalert_premium_monthly": "Месяц",
      "camalert_premium_yearly": "Год",
      "camalert_premium_lifetime": "Навсегда",
    ]
    for id in PremiumAccess.plans {
      let button = UIButton(type: .custom)
      let price = prices[id] ?? "Цена появится из магазина"
      let yearly = id == "camalert_premium_yearly"
      button.backgroundColor = yearly
        ? UIColor(red: 142 / 255, green: 95 / 255, blue: 24 / 255, alpha: 0.48)
        : UIColor(red: 19 / 255, green: 28 / 255, blue: 62 / 255, alpha: 0.82)
      button.layer.cornerRadius = 15
      button.layer.borderWidth = id == selected ? 2 : 1.2
      button.layer.borderColor = (yearly || id == selected)
        ? gold.cgColor
        : UIColor(red: 200 / 255, green: 207 / 255, blue: 244 / 255, alpha: 0.4).cgColor
      let period = UILabel()
      period.text = names[id] ?? id
      period.textColor = cream
      period.font = .camalert(13, weight: .heavy)
      period.textAlignment = .center
      let priceLabel = UILabel()
      priceLabel.text = price
      priceLabel.textColor = cream
      priceLabel.font = .camalert(13, weight: .heavy)
      priceLabel.textAlignment = .center
      priceLabel.adjustsFontSizeToFitWidth = true
      priceLabel.minimumScaleFactor = 0.25
      let column = UIStackView(arrangedSubviews: [period, priceLabel])
      column.axis = .vertical
      column.spacing = 1
      column.isUserInteractionEnabled = false
      column.translatesAutoresizingMaskIntoConstraints = false
      button.addSubview(column)
      NSLayoutConstraint.activate([
        column.leadingAnchor.constraint(equalTo: button.leadingAnchor, constant: 4),
        column.trailingAnchor.constraint(equalTo: button.trailingAnchor, constant: -4),
        column.centerYAnchor.constraint(equalTo: button.centerYAnchor),
      ])
      button.heightAnchor.constraint(equalToConstant: 74).isActive = true
      button.addAction(UIAction { [weak self] _ in
        self?.selected = id
        self?.showPlans(prices: prices)
        self?.terms.text = "\(names[id] ?? "") · \(price)"
      }, for: .touchUpInside)
      planRow.addArrangedSubview(button)
    }
    let price = prices[selected] ?? "Цена появится из магазина"
    terms.text = "\(names[selected] ?? "") · \(price)"
  }

  private func loadProducts() async {
    let loaded = (try? await Product.products(for: PremiumAccess.plans)) ?? []
    var prices: [String: String] = [:]
    for product in loaded { prices[product.id] = product.displayPrice }
    products = loaded
    await MainActor.run {
      self.showPlans(prices: prices)
      if loaded.isEmpty { self.note.text = "" }
    }
  }

  @objc private func buySelected() {
    guard let product = products.first(where: { $0.id == selected }) else {
      note.text = "Этот продукт ещё не пришёл из App Store."
      return
    }
    Task {
      do {
        let result = try await product.purchase()
        if case .success(let verification) = result, case .verified = verification {
          await MainActor.run { self.note.text = "Магазин подтвердил покупку: \(product.displayName)" }
        }
      } catch {
        await MainActor.run { self.note.text = "Покупка не завершилась" }
      }
    }
  }

  @objc private func restorePurchases() {
    Task {
      try? await AppStore.sync()
      await MainActor.run { self.note.text = "Запрос восстановления отправлен в App Store." }
    }
  }

  @objc private func manage() {
    if let url = URL(string: "https://apps.apple.com/account/subscriptions") { UIApplication.shared.open(url) }
  }

  private func advanceStage() {
    guard slides.count > 1, cardWidth > 0, stage.isDragging == false, stage.isTracking == false else { return }
    stagePage = (stagePage + 1) % slides.count
    stage.setContentOffset(CGPoint(x: CGFloat(stagePage) * (cardWidth + 12), y: 0), animated: true)
  }

  @objc private func goBack() {
    if let navigationController, navigationController.viewControllers.count > 1 {
      navigationController.popViewController(animated: true)
      return
    }
    dismiss(animated: true)
    NotificationCenter.default.post(name: .camalertShowTab, object: "settings")
  }
}

extension PremiumViewController: UIScrollViewDelegate {
  func scrollViewDidScroll(_ scrollView: UIScrollView) {
    guard cardWidth > 0 else { return }
    let page = Int(round(scrollView.contentOffset.x / (cardWidth + 12)))
    let index = min(max(page, 0), slides.count - 1)
    stagePage = index
    for case let dot as UIView in dots.arrangedSubviews {
      let on = dot.tag == index
      dot.backgroundColor = on ? gold : UIColor(white: 1, alpha: 0.35)
      dot.constraints.filter { $0.firstAttribute == .width }.forEach { $0.constant = on ? 18 : 8 }
    }
  }
}

private final class ProSlideCard: UIView {
  init(slide: (id: String, title: String, text: String), photo: UIImage?, gold: UIColor, cream: UIColor) {
    super.init(frame: .zero)
    clipsToBounds = true
    layer.cornerRadius = 20
    layer.borderWidth = 1.5
    layer.borderColor = UIColor(red: 255 / 255, green: 217 / 255, blue: 120 / 255, alpha: 1).cgColor
    backgroundColor = UIColor(red: 16 / 255, green: 26 / 255, blue: 58 / 255, alpha: 1)
    let image = UIImageView(image: photo)
    image.contentMode = .scaleAspectFill
    image.clipsToBounds = true
    image.tag = 41
    addSubview(image)
    let art = ProSlideArt(kind: slide.id, gold: gold)
    art.tag = 42
    addSubview(art)
    let title = UILabel()
    title.text = slide.title
    title.textColor = cream
    title.font = .camalert(18, weight: .black)
    let body = UILabel()
    body.text = slide.text
    body.textColor = cream
    body.font = .camalert(12)
    body.numberOfLines = 2
    let copy = UIStackView(arrangedSubviews: [title, body])
    copy.axis = .vertical
    copy.translatesAutoresizingMaskIntoConstraints = false
    addSubview(copy)
    NSLayoutConstraint.activate([
      copy.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 13),
      copy.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
      copy.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -9),
    ])
  }

  required init?(coder: NSCoder) { nil }
  override func layoutSubviews() {
    super.layoutSubviews()
    viewWithTag(41)?.frame = bounds
    viewWithTag(42)?.frame = bounds
  }
}

private final class ProSlideArt: UIView {
  private let kind: String
  private let gold: UIColor
  init(kind: String, gold: UIColor) {
    self.kind = kind
    self.gold = gold
    super.init(frame: .zero)
    isUserInteractionEnabled = false
    backgroundColor = .clear
    autoresizingMask = [.flexibleWidth, .flexibleHeight]
  }
  required init?(coder: NSCoder) { nil }
  override func draw(_ rect: CGRect) {
    guard let context = UIGraphicsGetCurrentContext() else { return }
    context.setStrokeColor(gold.cgColor)
    context.setFillColor(gold.cgColor)
    context.setLineWidth(4)
    switch kind {
    case "navigation":
      context.setStrokeColor(UIColor(red: 86 / 255, green: 201 / 255, blue: 255 / 255, alpha: 1).cgColor)
      context.setLineWidth(5)
      context.move(to: CGPoint(x: rect.midX - 40, y: 36))
      context.addQuadCurve(to: CGPoint(x: rect.midX + 30, y: rect.midY + 10), control: CGPoint(x: rect.midX - 10, y: rect.midY))
      context.strokePath()
      context.setFillColor(UIColor(red: 23 / 255, green: 141 / 255, blue: 228 / 255, alpha: 1).cgColor)
      context.fillEllipse(in: CGRect(x: rect.midX + 18, y: rect.midY, width: 18, height: 18))
    case "voice":
      context.setLineWidth(3)
      context.strokeEllipse(in: CGRect(x: rect.midX - 27, y: 28, width: 54, height: 65))
      context.setStrokeColor(gold.withAlphaComponent(0.42).cgColor)
      context.strokeEllipse(in: CGRect(x: rect.midX - 42, y: 16, width: 84, height: 90))
      context.setFillColor(gold.cgColor)
      context.fill(CGRect(x: rect.midX - 9, y: 42, width: 18, height: 35))
    case "background":
      context.setFillColor(UIColor(red: 255 / 255, green: 229 / 255, blue: 161 / 255, alpha: 1).cgColor)
      context.fillEllipse(in: CGRect(x: rect.midX + 28, y: 18, width: 29, height: 29))
      context.setStrokeColor(UIColor(red: 227 / 255, green: 232 / 255, blue: 244 / 255, alpha: 1).cgColor)
      context.setLineWidth(2)
      context.stroke(CGRect(x: rect.midX - 16, y: 36, width: 43, height: 72))
    case "settings":
      context.setLineWidth(4)
      for index in 0..<3 {
        let y = 48 + CGFloat(index) * 18
        context.move(to: CGPoint(x: 48, y: y))
        context.addLine(to: CGPoint(x: rect.width - 70, y: y))
        context.strokePath()
        let knobX: CGFloat = index == 1 ? rect.midX + 20 : rect.midX - 30
        context.setFillColor(gold.cgColor)
        context.fillEllipse(in: CGRect(x: knobX, y: y - 8, width: 16, height: 16))
      }
    default:
      context.setLineWidth(3)
      context.stroke(CGRect(x: rect.midX - 28, y: 30, width: 56, height: 36))
      context.fillEllipse(in: CGRect(x: rect.midX - 10, y: 38, width: 20, height: 20))
      context.setFillColor(UIColor(red: 8 / 255, green: 15 / 255, blue: 41 / 255, alpha: 1).cgColor)
      context.fillEllipse(in: CGRect(x: rect.midX - 5, y: 43, width: 10, height: 10))
    }
  }
}

private extension UIFont {
  func withWeight(_ weight: UIFont.Weight) -> UIFont {
    let descriptor = fontDescriptor.addingAttributes([.traits: [UIFontDescriptor.TraitKey.weight: weight]])
    return UIFont(descriptor: descriptor, size: pointSize)
  }
}
