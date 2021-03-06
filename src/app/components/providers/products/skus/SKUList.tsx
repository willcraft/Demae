import React, { useContext } from "react";
import { createStyles, Theme, makeStyles } from "@material-ui/core/styles";
import { Link } from "react-router-dom"
import { useTheme } from "@material-ui/core/styles";
import { Box, Paper, Typography, Tooltip, IconButton, ListItemAvatar, Avatar, Button } from "@material-ui/core";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import ListItemText from "@material-ui/core/ListItemText";
import ImageIcon from "@material-ui/icons/Image";
import AddCircleIcon from "@material-ui/icons/AddCircle";
import RemoveCircleIcon from "@material-ui/icons/RemoveCircle";
import DataLoading from "components/DataLoading";
import { useDataSourceListen, useDocumentListen, Where } from "hooks/firestore";
import { Provider, Product, SKU } from "models/commerce";
import { useCart, useUser } from "hooks/commerce"
import Cart, { CartGroup } from "models/commerce/Cart";
import NotFound from "components/NotFound"
import Login from "components/Login"
import { useImage } from "utils/ImageManager"
import { useDialog } from "components/Dialog"
import { useModal } from "components/Modal";
import { useMediator } from "hooks/url"

const useStyles = makeStyles((theme: Theme) =>
	createStyles({
		paper: {
			width: "100%"
		},
		avater: {
			width: theme.spacing(12),
			height: theme.spacing(12),
		}
	}),
);

export default ({ providerID, productID }: { providerID: string, productID: string }) => {

	const ref = new Provider(providerID)
		.products.doc(productID, Product)
		.skus
		.collectionReference

	const [skus, isSKULoading] = useDataSourceListen<SKU>(SKU, { path: ref.path, wheres: [Where("isAvailable", "==", true)], limit: 100 })
	const [product, isProductLoading] = useDocumentListen<Product>(Product, new Provider(providerID).products.collectionReference.doc(productID))

	if (isProductLoading || isSKULoading) {
		return (
			<DataLoading />
		)
	}

	if (!product) {
		return <NotFound />
	}

	return (
		<Paper elevation={0}>
			<List dense>
				{skus.map(sku => {
					return (
						<SKUListItem key={sku.id} providerID={providerID} product={product} sku={sku} />
					)
				})}
			</List>
		</Paper>
	)
}

const SKUListItem = ({ providerID, product, sku }: { providerID: string, product: Product, sku: SKU }) => {
	const classes = useStyles()
	const theme = useTheme()
	const [user] = useUser()
	const [cart] = useCart()
	const [showDialog] = useDialog()
	const [showModal, closeModal] = useModal()
	const mediatorID = useMediator()

	const imageURL = (sku.imagePaths().length > 0) ? sku.imagePaths()[0] : undefined
	const imgProps = useImage({ path: imageURL, alt: `${sku.name ?? ""} ${sku.caption ?? ""}`, sizes: "96px" })
	const amount = sku.price || 0
	const price = new Intl.NumberFormat("ja-JP", { style: "currency", currency: sku.currency }).format(amount)

	const withLogin = async (sku: SKU, onNext: (sku: SKU) => void) => {
		if (user) {
			onNext(sku)
		} else {
			showDialog("Please Login", undefined, [
				{
					title: "Cancel",
				},
				{
					title: "OK",
					variant: "contained",
					color: "primary",
					handler: () => {
						showModal(<Login onNext={async (user) => {
							onNext(sku)
							closeModal()
						}} />)
					}
				}
			])
		}
	}

	const addSKU = async (sku: SKU) => {
		withLogin(sku, async (sku) => {
			if (!product) return
			if (user) {
				const groupID = CartGroup.ID(product)
				if (cart) {
					const group = cart?.cartGroup(groupID) || CartGroup.fromSKU(product, sku)
					group.groupID = groupID
					group.addSKU(product, sku, mediatorID)
					cart?.setCartGroup(group)
					await cart.save()
				} else {
					const cart = new Cart(user.id)
					const group = cart?.cartGroup(groupID) || CartGroup.fromSKU(product, sku)
					group.groupID = groupID
					group.addSKU(product, sku, mediatorID)
					cart?.setCartGroup(group)
					await cart.save()
				}
			}
		})
	}

	const deleteSKU = async (sku: SKU) => {
		if (!cart) return
		const group = cart.cartGroup(providerID)
		group?.deleteSKU(sku)
		if ((group?.items.length || 0) <= 0) {
			cart.groups = cart.groups.filter(group => group.groupID !== providerID)
		}
		await cart.save()
	}

	return (
		<ListItem button component={Link} to={`/providers/${providerID}/products/${product.id}/skus/${sku.id}`}>
			<ListItemAvatar>
				<Avatar className={classes.avater} variant="rounded" {...imgProps}>
					<ImageIcon />
				</Avatar>
			</ListItemAvatar>
			<ListItemText
				primary={
					<>
						<Box mx={2} my={0} >
							<Box fontSize={16} fontWeight={800}>
								{sku.name}
							</Box>
							<Box>
								{price}
							</Box>
							<Box color="text.secondary">
								{sku.caption}
							</Box>
						</Box>
					</>
				}
				secondary={
					<>
						{/* <Box fontWeight="fontWeightMedium" fontSize="subtitle1" mx={2} my={0} >
								{`${ISO4217[product.currency]["symbol"]}${item.subtotal().toLocaleString()}`}
							</Box> */}
					</>
				} />
			<ListItemSecondaryAction>
				<Tooltip title="Delete" onClick={(e) => {
					e.stopPropagation()
					deleteSKU(sku)
				}}>
					<IconButton>
						<RemoveCircleIcon color="inherit" />
					</IconButton>
				</Tooltip>
				<Tooltip title="Add" onClick={(e) => {
					e.stopPropagation()
					addSKU(sku)
				}}>
					<IconButton>
						<AddCircleIcon color="inherit" />
					</IconButton>
				</Tooltip>
			</ListItemSecondaryAction>
		</ListItem>
	)
}
