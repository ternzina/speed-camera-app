import Foundation
import Security
import StoreKit
import UIKit

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
      var rows: [[String: Any]] = []
      for product in products {
        rows.append(await row(product))
      }
      done(rows)
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

  @objc public static func legacyEvidence(_ done: @escaping ([String: Any]) -> Void) {
    Task {
      var payload: [String: Any] = [:]
      if keychainLegacy() == "yes" {
        payload["keychain"] = "yes"
      }
      if let version = await originalAppVersion() {
        payload["originalVersion"] = version
      }
      done(payload)
    }
  }

  @objc public static func rememberLegacyYes(_ done: @escaping (Bool) -> Void) {
    done(writeKeychainYes())
  }

  @objc public static func requestReview(_ done: @escaping (NSNumber) -> Void) {
    DispatchQueue.main.async {
      let scene = UIApplication.shared.connectedScenes
        .compactMap { $0 as? UIWindowScene }
        .first { $0.activationState == .foregroundActive }
      guard let scene else {
        done(false)
        return
      }
      SKStoreReviewController.requestReview(in: scene)
      done(true)
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

  private static func row(_ product: Product) async -> [String: Any] {
    var value: [String: Any] = [
      "id": product.id,
      "displayPrice": product.displayPrice,
    ]
    if let subscription = product.subscription {
      value["period"] = unitName(subscription.subscriptionPeriod.unit)
      var eligible = false
      if let offer = subscription.introductoryOffer, offer.paymentMode == .freeTrial {
        value["trial"] = true
        value["trialPeriod"] = unitName(offer.period.unit)
        value["trialCount"] = offer.period.value
        eligible = (try? await subscription.isEligibleForIntroOffer) ?? false
      }
      value["introEligible"] = eligible
    } else {
      value["period"] = "lifetime"
      value["introEligible"] = false
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

  private static func keychainQuery() -> [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: "com.21wek.camera.premium",
      kSecAttrAccount as String: "legacy-access",
    ]
  }

  private static func keychainLegacy() -> String? {
    var query = keychainQuery()
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    guard status == errSecSuccess, let data = item as? Data, let text = String(data: data, encoding: .utf8) else {
      return nil
    }
    return text == "yes" ? "yes" : nil
  }

  private static func writeKeychainYes() -> Bool {
    let data = Data("yes".utf8)
    var query = keychainQuery()
    let updated = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
    if updated == errSecSuccess { return true }
    query[kSecValueData as String] = data
    query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
    return SecItemAdd(query as CFDictionary, nil) == errSecSuccess
  }

  private static func originalAppVersion() async -> String? {
    do {
      let result = try await AppTransaction.shared
      guard case .verified(let transaction) = result else { return nil }
      return transaction.originalAppVersion
    } catch {
      return nil
    }
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
