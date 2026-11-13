import Foundation
import StoreKit

// StoreKit is the only place a purchase can start. The module does not
// decide that a feature is locked; that stays off until access is an
// explicit decision.
@objc(CamAlertPremiumStoreKit)
public final class CamAlertPremiumStoreKit: NSObject {
  @objc public static let productIds = [
    "camalert_premium_weekly",
    "camalert_premium_monthly",
    "camalert_premium_yearly",
    "camalert_premium_lifetime",
  ]

  @objc public static func loadProducts(_ done: @escaping ([[String: Any]]) -> Void) {
    Task {
      let products = (try? await Product.products(for: Set(productIds))) ?? []
      done(products.map(row))
    }
  }

  @objc public static func purchase(_ productId: String, done: @escaping ([String: Any]) -> Void) {
    Task {
      guard let product = try? await Product.products(for: [productId]).first else {
        done(["status": "unavailable"])
        return
      }
      do {
        let result = try await product.purchase()
        switch result {
        case .success(let verification):
          guard case .verified(let transaction) = verification else {
            done(["status": "unverified"])
            return
          }
          await transaction.finish()
          var payload = entitlement(transaction)
          payload["status"] = "verified"
          done(payload)
        case .userCancelled:
          done(["status": "cancelled"])
        case .pending:
          done(["status": "pending"])
        @unknown default:
          done(["status": "unavailable"])
        }
      } catch {
        done(["status": "failed"])
      }
    }
  }

  @objc public static func restore(_ done: @escaping ([[String: Any]]) -> Void) {
    Task {
      try? await AppStore.sync()
      var rows: [[String: Any]] = []
      for await result in Transaction.currentEntitlements {
        guard case .verified(let transaction) = result else { continue }
        rows.append(entitlement(transaction))
      }
      done(rows)
    }
  }

  private static func row(_ product: Product) -> [String: Any] {
    var value: [String: Any] = [
      "id": product.id,
      "displayPrice": product.displayPrice,
    ]
    if let subscription = product.subscription {
      value["period"] = unitName(subscription.subscriptionPeriod.unit)
      if let offer = subscription.introductoryOffer, offer.paymentMode == .freeTrial {
        value["trial"] = true
        value["trialPeriod"] = unitName(offer.period.unit)
        value["trialCount"] = offer.period.value
      }
    } else {
      value["period"] = "lifetime"
    }
    return value
  }

  private static func entitlement(_ transaction: Transaction) -> [String: Any] {
    var value: [String: Any] = [
      "productId": transaction.productID,
      "revoked": transaction.revocationDate != nil,
    ]
    if let expiration = transaction.expirationDate {
      value["expiresAt"] = expiration.timeIntervalSince1970 * 1000
    } else {
      value["period"] = "lifetime"
    }
    if transaction.offerType == .introductory {
      value["trial"] = true
    }
    return value
  }

  private static func unitName(_ unit: Product.SubscriptionPeriod.Unit) -> String {
    switch unit {
    case .day: return "day"
    case .week: return "week"
    case .month: return "month"
    case .year: return "year"
    @unknown default: return "unknown"
    }
  }
}
