const puppeteer = require('puppeteer')

const STATS_PAGE = 'https://medium.com/me/stats'
const SIGN_IN_BUTTON_TEXT = 'Sign in with Google'
// const CHROME_EXECUTABLE_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const USER_DATA_DIR = './Google/Chrome/User Data/'
const MEDIUM_ROW_ID_ATTRIBUTE = 'data-action-value'
const MEDIUM_ROW_CLASS_NAME = 'js-statsTableRow'
const VIEW_STORY_TEXT = 'View story'
const TOGGLE_SPAN_TEXT = 'Post management tools menu'
const EDIT_STORY_TEXT = 'Edit story'

const updatePromotionInStories = async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    userDataDir: USER_DATA_DIR,
    args: ['--start-fullscreen']
  })

  const page = await browser.newPage()
  const response = await page.goto(STATS_PAGE)
  const redirectsChain = response.request().redirectChain()
  if (redirectsChain.length) {
    const [button] = await page.$x(`//button[contains(., '${SIGN_IN_BUTTON_TEXT}')]`)
    await button.click()
  }

  // const rows = await page.$$('.js-statsTableRow')
  const rowId = await page.evaluate((className, attributeName) => {
    const [currentRow] = document.getElementsByClassName(className)
    currentRow.scrollIntoView()
    return currentRow.getAttribute(attributeName)
  }, MEDIUM_ROW_CLASS_NAME, MEDIUM_ROW_ID_ATTRIBUTE)
  const row = await page.$(`[${MEDIUM_ROW_ID_ATTRIBUTE}="${rowId}"]`)
  const [viewStoryElement] = await row.$x(`//a[contains(., '${VIEW_STORY_TEXT}')]`)
  await viewStoryElement.click({button: 'middle'})

  const pages = await browser.pages()
  console.log(pages.length)
  const storyPage = pages[pages.length - 1]
  storyPage.bringToFront()
  await storyPage.waitForNavigation()

  const [spanInsideButton] = await storyPage.$x(`//span[contains(., '${TOGGLE_SPAN_TEXT}')]`)
  const [toggleButton] = await spanInsideButton.$x('..')
  await toggleButton.click()
  const [editStory] = await storyPage.$x(`//a[contains(., '${EDIT_STORY_TEXT}')]`)
  await editStory.click()
}

updatePromotionInStories()