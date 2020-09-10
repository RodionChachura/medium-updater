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
const LAST_SECTION_CLASS_NAME = 'section--last'
const SECTION_DIVIDER_CLASS_NAME = 'section-divider'
const SAVE_BUTTON_TEXT = 'Save and publish'

const getByClassName = (element, className) => {
  return element.$$(`.${className}`)
}

const getElementWithText = async (element, tag, text) => {
  const [result] = await element.$x(`//${tag}[contains(., '${text}')]`)
  return result
}

const deletePromotionElement = async (page, section, tag) => {
  const [element] = await section.$$(tag)
  await element.click({ clickCount: 3 })
  await page.keyboard.press('Backspace')
}

const updatePromotionInStories = async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    userDataDir: USER_DATA_DIR,
    args: ['--start-fullscreen']
  })

  const statsPage = await browser.newPage()
  const response = await statsPage.goto(STATS_PAGE)
  const redirectsChain = response.request().redirectChain()
  if (redirectsChain.length) {
    const button = await getElementWithText(statsPage, 'button', SIGN_IN_BUTTON_TEXT)
    await button.click()
  }

  const rowId = await statsPage.evaluate((className, attributeName) => {
    const [currentRow] = document.getElementsByClassName(className)
    currentRow.scrollIntoView()
    return currentRow.getAttribute(attributeName)
  }, MEDIUM_ROW_CLASS_NAME, MEDIUM_ROW_ID_ATTRIBUTE)
  const row = await statsPage.$(`[${MEDIUM_ROW_ID_ATTRIBUTE}="${rowId}"]`)
  const viewStoryElement = await getElementWithText(row, 'a', VIEW_STORY_TEXT)
  await viewStoryElement.click({ button: 'middle' })

  const pages = await browser.pages()
  const storyPage = pages[pages.length - 1]
  storyPage.bringToFront()
  await storyPage.waitForNavigation()

  const spanInsideButton = await getElementWithText(storyPage, 'span', TOGGLE_SPAN_TEXT)
  const [toggleButton] = await spanInsideButton.$x('..')
  await toggleButton.click()
  const editStory = await getElementWithText(storyPage, 'a', EDIT_STORY_TEXT)
  await editStory.click()
  await storyPage.waitForSelector(`.${LAST_SECTION_CLASS_NAME}`)

  await storyPage.evaluate((className) => {
    const [lastSection] = document.getElementsByClassName(className)
    lastSection.scrollIntoView()
    window.scrollBy(0, -80)
  }, LAST_SECTION_CLASS_NAME)

  await new Promise(resolve => setTimeout(resolve, 1000))
  const [lastSection] = await getByClassName(storyPage, LAST_SECTION_CLASS_NAME)
  const [sectionDivider] = await getByClassName(storyPage, SECTION_DIVIDER_CLASS_NAME)
  if (sectionDivider) {
    await deletePromotionElement(storyPage, lastSection, 'figure')
    await deletePromotionElement(storyPage, lastSection, 'p')
  
    await storyPage.keyboard.down('Meta')
    await storyPage.keyboard.press('V')
  
    const saveButton = await getElementWithText(storyPage, 'span', SAVE_BUTTON_TEXT)
    await saveButton.click()
  }
}

updatePromotionInStories()