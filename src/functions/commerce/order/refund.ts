import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import { regionFunctions } from "../../helper"
import { getProviderID } from "../helper"
import { Response } from "./helper"
import Stripe from "stripe"
import Provider from "../../models/commerce/Provider"
import User from "../../models/commerce/User"
import Order from "../../models/commerce/Order"

export const refund = regionFunctions.https.onCall(async (data, context) => {
	if (!context.auth) {
		throw new functions.https.HttpsError("failed-precondition", "The function must be called while authenticated.")
	}
	const STRIPE_API_KEY = functions.config().stripe.api_key
	if (!STRIPE_API_KEY) {
		throw new functions.https.HttpsError("invalid-argument", "The functions requires STRIPE_API_KEY.")
	}
	functions.logger.info(data)
	const uid: string = context.auth.uid
	const stripe = new Stripe(STRIPE_API_KEY, { apiVersion: "2020-03-02" })
	const orderID = data.orderID
	if (!orderID) {
		throw new functions.https.HttpsError("invalid-argument", "This request does not contain a orderID.")
	}
	const providerID = await getProviderID(uid)
	if (!providerID) {
		throw new functions.https.HttpsError("invalid-argument", "Auth does not maintain a providerID.")
	}
	const providerOrderRef = new Provider(providerID).orders.collectionReference.doc(orderID)
	try {
		const result = await admin.firestore().runTransaction(async transaction => {
			try {
				const snapshot = await transaction.get(providerOrderRef)
				const order = Order.fromSnapshot<Order>(snapshot)
				if (!order) {
					throw new functions.https.HttpsError("invalid-argument", "This user has not this order.")
				}
				// Check order cancellable.
				const request = await refundRequestForOrder(uid, order)
				const result = await stripe.refunds.create(request, {
					idempotencyKey: `${providerOrderRef.path}-refund`
				})
				const userOrderRef = new User(order.purchasedBy).orders.collectionReference.doc(order.id)
				order.items = order.items.map(item => {
					item.status = "canceled"
					return item
				})
				order.refundStatus = "succeeded"
				order.refundResult = result
				order.isCanceled = true
				transaction.set(userOrderRef, {
					...order.data(),
					updatedAt: admin.firestore.FieldValue.serverTimestamp()
				})
				transaction.set(providerOrderRef, {
					...order.data(),
					updatedAt: admin.firestore.FieldValue.serverTimestamp()
				})
				return order.data({ convertDocumentReference: true })
			} catch (error) {
				throw error
			}
		})
		return { result } as Response
	} catch (error) {
		functions.logger.error(error)
		return { error }
	}
})

const refundRequestForOrder = async (uid: string, order: Order) => {
	const paymentIntentID = order.paymentResult.id
	if (!paymentIntentID) {
		throw new functions.https.HttpsError("internal", "Your order does not contain the required information.")
	}
	const userRecord = await admin.auth().getUser(uid)
	if (!userRecord.customClaims) throw new functions.https.HttpsError("permission-denied", `The user does not have the right to change the order.`)
	const adminUser = userRecord.customClaims.admin
	if (!adminUser) throw new functions.https.HttpsError("permission-denied", `The user does not have the right to change the order.`)
	if (order.providedBy !== adminUser) throw new functions.https.HttpsError("permission-denied", `The user does not have the right to change the order.`)
	const reverse_transfer = !!order.transferResults
	const request = {
		payment_intent: paymentIntentID,
		reason: "requested_by_customer",
		refund_application_fee: false,
		reverse_transfer: reverse_transfer,
		metadata: {
			admin: adminUser,
			uid: uid
		}
	} as Stripe.RefundCreateParams
	return request
}
