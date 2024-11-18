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

    mongoose.set('bufferTimeoutMS', 20000)

    mongoose.connection.once('connected', () => {
      console.log('Successfully connected to MongoDB')
    })

    await mongoose.connect(URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    })
  } catch (error) {
    console.error('Error connecting to DB:', error)
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

  await page.type('#js-site-search-input', 'barbie')
  await page.click('.input-group-btn')
  await page.waitForSelector('.product__listing')

  let allProducts = []
  let previousHeight

  while (true) {
    const productsOnPage = await page.evaluate(() => {
      const titles = Array.from(
        document.querySelectorAll('a.name.js-analytics-productClick')
      ).map((el) => el.innerText)
      const prices = Array.from(document.querySelectorAll('.price')).map(
        (el) => el.innerText
      )
      const images = Array.from(
        document.querySelectorAll('.product__listing.product__grid .thumb img')
      ).map((el) => el.src)

      return titles.map((title, index) => ({
        title,
        price: prices[index] || 'Precio no disponible',
        image: images[index]
      }))
    })

    allProducts = [...allProducts, ...productsOnPage]

    console.log(`Productos recogidos hasta ahora: ${allProducts.length}`)

    previousHeight = await page.evaluate('document.body.scrollHeight')
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const newHeight = await page.evaluate('document.body.scrollHeight')

    if (newHeight === previousHeight) {
      break
    }
  }

  console.log('Guardando datos en MongoDB...')
  for (let product of allProducts) {
    const dataSchema = new Data(product)
    try {
      await dataSchema.save()
      console.log(`Producto guardado: ${product.title}`)
    } catch (error) {
      console.error('Error guardando en la BD:', error)
    }
  }

  fs.writeFileSync('products.json', JSON.stringify(allProducts, null, 2))
  console.log('Todos los productos se han guardado en products.json')

  await browser.close()
}

scrapeProduct()
