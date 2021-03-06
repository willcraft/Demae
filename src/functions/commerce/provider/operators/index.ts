import * as functions from "firebase-functions"
import { regionFunctions } from "../../../helper"
import User from "../../../models/commerce/User"

const triggerdPath = "/commerce/{version}/providers/{providerID}/operators/{userID}"

export const onCreate = regionFunctions.firestore
	.document(triggerdPath)
	.onCreate(async (snapshot, context) => {
		console.info(context)
		const providerID = context.params.providerID
		const userID = context.params.providerID
		const user = new User(userID)
		const data = snapshot.data()
		functions.logger.log(`[Firestore][${snapshot.ref.path}][onCreate]`, data)
		if (data) {
			await user.providers.collectionReference.doc(providerID).set(data)
		}
	})

export const onUpdate = regionFunctions.firestore
	.document(triggerdPath)
	.onUpdate(async (snapshot, context) => {
		console.info(context)
		const providerID = context.params.providerID
		const userID = context.params.providerID
		const user = new User(userID)
		const data = snapshot.after.data()
		functions.logger.log(`[Firestore][${snapshot.after.ref.path}][onUpdate]`, data)
		if (data) {
			await user.providers.collectionReference.doc(providerID).set(data)
		}
	})
