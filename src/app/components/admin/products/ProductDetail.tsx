
import React, { useState, useRef } from "react"
import firebase from "firebase"
import { File as StorageFile } from "@1amageek/ballcap"
import Button from "@material-ui/core/Button";
import { Table, TableBody, TableRow, TableCell, Typography } from "@material-ui/core";
import Avatar from "@material-ui/core/Avatar";
import DndCard from "components/DndCard"
import Box from "@material-ui/core/Box";
import Select, { useSelect } from "components/Select"
import Product, { DeliveryMethod } from "models/commerce/Product"
import ImageIcon from "@material-ui/icons/Image";
import EditIcon from "@material-ui/icons/Edit";
import SaveIcon from "@material-ui/icons/Save";
import { useAdminProviderProduct } from "hooks/commerce";
import DataLoading from "components/DataLoading";
import Board from "../Board";
import { useProcessing } from "components/Processing";
import Label from "components/Label";
import TextField, { useTextField } from "components/TextField"

const deliveryMethodLabel: { [key in DeliveryMethod]: string } = {
	"none": "No shipping required",
	"download": "download",
	"pickup": "Pickup",
	"shipping": "Shipping required"
}

export default () => {
	const [product, isLoading] = useAdminProviderProduct()
	const [isEditing, setEdit] = useState(false)

	if (isLoading) {
		return (
			<Board>
				<Box flexGrow={1} alignItems="center" justifyContent="center">
					<DataLoading />
				</Box>
			</Board>
		)
	}

	if (!product) {
		return (
			<Board link="/admin/products">
				<Box flexGrow={1} alignItems="center" justifyContent="center">
					<Box fontSize={16} fontWeight={600}></Box>
				</Box>
			</Board>
		)
	}

	if (isEditing) {
		return <Edit product={product} onClose={() => {
			setEdit(false)
		}} />
	}

	return (
		<Board link="/admin/products" header={
			<Box display="flex" flexGrow={1} alignItems="center">
				{product.name}
				<Box flexGrow={1} />
				<Button
					variant="contained"
					color="primary"
					size="small"
					disableElevation
					startIcon={
						<EditIcon />
					}
					onClick={async () => {
						setEdit(true)
					}}
				>Edit</Button>
			</Box>
		}>
			<Avatar variant="square" src={product.imageURLs()[0]} style={{
				minHeight: "200px",
				width: "100%"
			}}>
				<ImageIcon />
			</Avatar>
			<Table>
				<TableBody>
					<TableRow>
						<TableCell align="right"><div>ID</div></TableCell>
						<TableCell align="left"><div>{product.id}</div></TableCell>
					</TableRow>
					<TableRow>
						<TableCell align="right"><div>name</div></TableCell>
						<TableCell align="left"><div>{product.name}</div></TableCell>
					</TableRow>
					<TableRow>
						<TableCell align="right"><div>caption</div></TableCell>
						<TableCell align="left"><div>{product.caption}</div></TableCell>
					</TableRow>
					<TableRow>
						<TableCell align="right"><div>description</div></TableCell>
						<TableCell align="left"><div style={{
							wordWrap: "break-word",
							overflowWrap: "break-word"
						}}>{product.description}</div></TableCell>
					</TableRow>
					<TableRow>
						<TableCell align="right"><div>Delivery method</div></TableCell>
						<TableCell align="left"><div>{deliveryMethodLabel[product.deliveryMethod]}</div></TableCell>
					</TableRow>
					<TableRow>
						<TableCell align="right"><div>Status</div></TableCell>
						<TableCell align="left"><div>{product.isAvailable ? <Label color="green">Available</Label> : <Label color="red">Unavailable</Label>}</div></TableCell>
					</TableRow>
				</TableBody>
			</Table>
		</Board >
	)
}


const Edit = ({ product, onClose }: { product: Product, onClose: () => void }) => {
	const [setProcessing] = useProcessing()
	const [images, setImages] = useState<File[]>([])

	const [name] = useTextField(product.name)
	const [caption] = useTextField(product.caption)
	const [description] = useTextField(product.description)
	const deliveryMethod = useSelect({
		initValue: product.deliveryMethod,
		inputProps: {
			menu: [
				{
					label: "No shipping required",
					value: "none"
				},
				{
					label: "Pickup",
					value: "pickup"
				},
				{
					label: "Shipping required",
					value: "shipping"
				},
			]
		}
	})
	const isAvailable = useSelect({
		initValue: product.isAvailable.toString() || "true",
		inputProps: {
			menu: [
				{
					label: "Available",
					value: "true"
				},
				{
					label: "Unavailable",
					value: "false"
				}
			]
		}
	})

	const onSubmit = async (event) => {
		event.preventDefault()
		if (!product) return
		setProcessing(true)
		const uploadedImages = await Promise.all(uploadImages(images))
		if (uploadedImages.length) {
			const fileterd = uploadedImages.filter(image => !!image) as StorageFile[]
			product.images = fileterd
		}
		product.name = name.value as string
		product.caption = caption.value as string
		product.description = description.value as string
		product.deliveryMethod = deliveryMethod.value as DeliveryMethod
		product.isAvailable = (isAvailable.value === "true")
		await product.save()
		setProcessing(false)
		onClose()
	}

	const uploadImages = (files: File[]) => {
		return files.map(file => {
			return uploadImage(file)
		})
	}

	const extension = (type: string) => {
		if (type === "image/jpeg") return "jpg"
		if (type === "image/png") return "png"
	}

	const uploadImage = (file: File): Promise<StorageFile | undefined> => {
		const id = firebase.firestore().collection("/dummy").doc().id
		const ref = firebase.storage().ref(product!.documentReference.path + `/images/${id}.${extension(file.type)}`)
		return new Promise((resolve, reject) => {
			ref.put(file).then(async (snapshot) => {
				if (snapshot.state === "success") {
					const storageFile = new StorageFile()
					if (snapshot.metadata.contentType) {
						storageFile.mimeType = snapshot.metadata.contentType
					}
					storageFile.path = ref.fullPath
					resolve(storageFile)
				} else {
					reject(undefined)
				}
			})
		})
	}

	return (
		<form onSubmit={onSubmit}>
			<Board header={
				<Box display="flex" flexGrow={1} alignItems="center">
					{product.name}
					<Box flexGrow={1} />
					<Button
						color="primary"
						onClick={async () => {
							onClose()
						}}
					>Cancel</Button>
					<Button
						variant="contained"
						color="primary"
						type="submit"
						startIcon={
							<SaveIcon />
						}
					>Save</Button>
				</Box>
			}>
				<Box display="flex" flexGrow={1} minHeight={200}>
					<DndCard
						url={product.imageURLs()[0]}
						onDrop={(files) => {
							setImages(files)
						}} />
				</Box>
				<Table>
					<TableBody>
						<TableRow>
							<TableCell align="right"><div>ID</div></TableCell>
							<TableCell align="left"><div>{product.id}</div></TableCell>
						</TableRow>
						<TableRow>
							<TableCell align="right"><div>name</div></TableCell>
							<TableCell align="left">
								<div>
									<TextField variant="outlined" margin="dense" required {...name} />
								</div>
							</TableCell>
						</TableRow>
						<TableRow>
							<TableCell align="right"><div>caption</div></TableCell>
							<TableCell align="left">
								<div>
									<TextField variant="outlined" margin="dense" {...caption} />
								</div>
							</TableCell>
						</TableRow>
						<TableRow>
							<TableCell align="right"><div>description</div></TableCell>
							<TableCell align="left">
								<div>
									<TextField variant="outlined" margin="dense" multiline {...description} fullWidth rows={4} />
								</div>
							</TableCell>
						</TableRow>
						<TableRow>
							<TableCell align="right"><div>delivery method</div></TableCell>
							<TableCell align="left">
								<div>
									<Select fullWidth {...deliveryMethod} />
								</div>
							</TableCell>
						</TableRow>
						<TableRow>
							<TableCell align="right"><div>Status</div></TableCell>
							<TableCell align="left">
								<div>
									<Select fullWidth {...isAvailable} />
								</div>
							</TableCell>
						</TableRow>
					</TableBody>
				</Table>
			</Board>
		</form>
	)
}
