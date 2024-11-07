const puppeteer = require('puppeteer')
const mongoose = require('mongoose')
const fs = require('fs')

require('dotenv').config()

const Data = mongoose.model(
  'Data',
  new mongoose.Schema({
    title: String,
    price: String,
    image: String
  })
)

const connect = async () => {
  try {
    const URI = process.env.MONGODB_URI

    await mongoose.connect(URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    })
    console.log('Connected to DB')
  } catch (error) {
    console.log(error)
  }
}

const scrapeProduct = async () => {
  await connect()

  const url = 'https://www.toysrus.es/'
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  })

  const page = await browser.newPage()
  await page.goto(url)

  // Quitar modales (si aparecen)
  try {
    await page.waitForSelector('.modal-selector', { timeout: 5000 }) // Ajusta el selector del modal si es necesario
    await page.click('.modal-close-button') // Ajusta el selector del botón de cierre
    console.log('Modal cerrado')
  } catch (error) {
    console.log('No se encontró modal, continuando...')
  }

  await page.type('#js-site-search-input', 'furby')
  await page.click('.input-group-btn')
  await page.waitForSelector('.glyphicon-chevron-right')

  let allProducts = []
  let hasNextPage = true

  while (hasNextPage) {
    const title = await page.$$eval(
      'a.name.js-analytics-productClick',
      (nodes) => nodes.map((n) => n.innerText)
    )
    const price = await page.$$eval('.price', (nodes) =>
      nodes.map((n) => n.innerText)
    )
    const image = await page.$$eval(
      '.product__listing.product__grid .thumb img',
      (imgs) => imgs.map((img) => img.src)
    )

    const products = title.map((title, index) => ({
      title,
      price: price[index],
      image: image[index]
    }))

    allProducts = allProducts.concat(products)

    const nextButton = await page.$(
      'li.pagination-next a.glyphicon-chevron-right'
    )
    if (nextButton) {
      await nextButton.click()
      await page.waitForTimeout(2000) // Espera para cargar la siguiente página
    } else {
      hasNextPage = false
    }
  }

  // Guardar los datos en la base de datos
  for (let product of allProducts) {
    const dataSchema = new Data(product)
    try {
      await dataSchema.save()
      console.log(`Data saved: ${product.title}`)
    } catch (error) {
      console.error(error)
    }
  }

  fs.writeFileSync('products.json', JSON.stringify(allProducts, null, 2))
  console.log('All products saved to products.json')

  await browser.close()
}

scrapeProduct()
