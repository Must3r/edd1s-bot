const TelegramBot = require('node-telegram-bot-api')
const { db } = require('./firebase.js')
const products = require('./fake/products.json')

const TOKEN = '6595212066:AAHQebVfMIWTL3FXBaYIgtFuuBmT6KX82fU'
const GROUP_ID = '-4046110812'
const STAFF_GROUP_ID = '-4031131799'
const bot = new TelegramBot(TOKEN, {polling: true});
const app = 'https://edd1s.netlify.app'
const productsRef = db.collection('products')

bot.on('message', async (msg) => {
  const chatId = msg.chat.id
  const text = msg.text

  if (text === '/start') {
    await bot.sendMessage(chatId, `${msg}`);
    await bot.sendMessage(chatId, `Натискай кнопку "Замовити" в моєму меню та ні в чому собі не відмовляй :)`, {
      reply_markup: {
        keyboard: [
          [ { text: 'Замовити', web_app: { url: app } } ]
        ]
      }
    });
    await bot.sendMessage(chatId, `<strong>Приєднуйся да нашої групи</strong>\n<strong>КОВБАСНА РОДИНА.</strong>\nТам завжди актуальна інформація про наявність асортименту, цікаві новини та акції`, {
      reply_markup: {
        inline_keyboard: [
          [ { text: 'Приєднатися', url: 't.me/kovbasna_rodyna' } ]
        ]
      },
      parse_mode: 'html'
    });
  }

  if (msg?.web_app_data?.data) {
    try {
      const data = JSON.parse(msg?.web_app_data?.data)
      if (data?.success) {
        await bot.sendMessage(
          chatId,
          `Дякуємо за Ваше замовлення!\nЧекаємо на Вас у магазині "${data?.success.name}"\nза адресою: ${data?.success.address}.`
        )
        await bot.sendLocation(chatId, data?.success.location?.lat, data?.success.location?.lng)
        await bot.sendMessage(
          (data?.success?.tgid || STAFF_GROUP_ID),
          `НОВЕ ЗАМОВЛЕННЯ\n\n<strong>"${data?.success?.name}, ${data?.success?.address}"</strong>\n${data?.success?.list.map((item, index) => `${index + 1}. ${item.title} - ${item.quantity} уп.\n`).join('')}\n\n${data?.success?.person?.name}\n${data?.success?.person?.phone}`,
          { parse_mode: 'html' }
        )
      }
      if (data?.over && data?.over.length > 0) {
        data.over.forEach(d => {
          const message = `Нажаль, товар <strong>"${d.title}"</strong> в магазині <strong>"${d.store?.name}"</strong> за адресою <strong>${d.store.address}</strong> вже закінчився.\nЧекаємо на вас завтра :)\n${d.image}`
          bot.sendMessage(GROUP_ID, message, {
            reply_markup: {
              inline_keyboard: [
                [ { text: 'Замовити щось інше', url: `t.me/edd1sbot` } ]
              ]
            },
            parse_mode: 'html'
          })
        })
      }
      if (data?.end) {
        setTimeout(() => {
          bot.sendMessage(GROUP_ID, data?.end, {
            reply_markup: {
              inline_keyboard: [
                [ { text: 'Замовити в іншому магазині', url: `t.me/edd1sbot` } ]
              ]
            },
            parse_mode: 'html'
          })
        }, 3000)
      }
    } catch (err) {
      console.log(err)
    }
  }
});

async function getProducts() {
  const products = []
  const snapshot = await productsRef.get()
  snapshot.forEach(p => {
    products.push(p.data())
  })
  return products
}

async function fillFakeProducts() {
  await productsRef.add(products)
}

async function sendMessage() {
  const products = await getProducts()
  const productsList = []
  const title = 'Сьогодні в асортименті:\n\n'
  products.forEach(({ store, list }) => {
    productsList.push(`<strong>${store.name}, (${store.address}):</strong>\n${list.map((item, index) => `${index + 1}. ${item.title} - ${item.quantity} уп.\n`).join('')}\n`)
  })
  const message = title.concat(productsList.join(''))
  await bot.sendMessage(GROUP_ID, message, {
    reply_markup: {
      inline_keyboard: [
        [ { text: 'Замовити', url: `t.me/edd1sbot` } ]
      ]
    },
    parse_mode: 'html'
  })
}

async function sendReminding() {
  await bot.sendMessage(
    GROUP_ID,
    `<strong><em>АВТОМАТИЧНЕ НАГАДУВАННЯ</em></strong>\nЗа дві години <em>(о 20:00)</em> бронь на замовлення анулюється. Якщо ви ще не забрали замовлення, зараз - саме час :)`,
    { parse_mode: 'html' })
}

function runAtSpecificTime(hour, minutes, func) {
  const twentyFourHours = 86400000
  const now = new Date()
  let eta_ms = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minutes, 0, 0).getTime() - now
  if (eta_ms < 0) eta_ms += twentyFourHours
  setTimeout(function() {
    //run once
    func()
    // run every 24 hours from now on
    setInterval(func, twentyFourHours)
  }, eta_ms)
}
// fillFakeProducts()
runAtSpecificTime(16, 0, async () => { await sendReminding() })
runAtSpecificTime(18, 0, async () => { await sendMessage() })
