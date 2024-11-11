const puppeteer = require('puppeteer')
const mongoose = require('mongoose')

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

  await page.type('#js-site-search-input', 'furby')

  await page.click('.input-group-btn')

  await page.waitForSelector('.glyphicon-chevron-right')

  const title = await page.$$eval('a.name.js-analytics-productClick', (nodes) =>
    nodes.map((n) => n.innerText)
  )

  const price = await page.$$eval('.price', (nodes) =>
    nodes.map((n) => n.innerText)
  )
  const image = await page.$$eval(
    '.product__listing.product__grid .thumb img',
    (imgs) => imgs.map((img) => img.src)
  )

  const products = title.slice(0, 25).map((title, index) => {
    return {
      title,
      price: price[index],
      image: image[index]
    }
  })

  products.map(async (data) => {
    const dataSchema = new Data(data)
    try {
      await dataSchema.save()
      console.log('Data saved')
    } catch (error) {
      console.error(error)
    }
  })

  await browser.close()
  console.log('all saved Successfully')
}

scrapeProduct()
