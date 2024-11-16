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

  // Buscar "barbie"
  await page.type('#js-site-search-input', 'barbie')
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
      price: price[index] || 'Precio no disponible',
      image: image[index]
    }))

    allProducts = allProducts.concat(products)

    console.log(`Productos recogidos hasta ahora: ${allProducts.length}`)

    // Intentar ir a la siguiente página
    try {
      const nextButton = await page.$(
        'li.pagination-next a.glyphicon-chevron-right'
      )
      if (nextButton) {
        const isVisible = await page.evaluate((btn) => {
          const style = window.getComputedStyle(btn)
          return (
            style && style.display !== 'none' && style.visibility === 'visible'
          )
        }, nextButton)

        if (isVisible) {
          await nextButton.click()
          await page.waitForTimeout(2000) // Esperar para cargar la siguiente página
        } else {
          console.log('El botón de la siguiente página no es visible.')
          hasNextPage = false
        }
      } else {
        console.log('No hay botón de la siguiente página.')
        hasNextPage = false
      }
    } catch (error) {
      console.error(
        'Error al intentar hacer clic en el botón de la siguiente página:',
        error
      )
      hasNextPage = false
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
