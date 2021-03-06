const puppeteer = require('puppeteer')

const STATS_PAGE = 'https://medium.com/me/stats'
const SIGN_IN_BUTTON_TEXT = 'Sign in with Google'
const USER_DATA_DIR = './Google/Chrome/User Data/'
const MEDIUM_ROW_ID_ATTRIBUTE = 'data-action-value'
const MEDIUM_ROW_CLASS_NAME = 'js-statsTableRow'
const TOGGLE_SPAN_TEXT = 'Post management tools menu'
const EDIT_STORY_TEXT = 'Edit story'
const LAST_SECTION_CLASS_NAME = 'section--last'
const SECTION_DIVIDER_CLASS_NAME = 'section-divider'
const SAVE_BUTTON_TEXT = 'Save and publish'
const STORY_LINK_CLASS_NAME = 'sortableTable-link'
const VIEW_STORY_TEXT = 'View story'

const [startWith] = process.argv.slice(2)

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

const gitFirstStory = (statsPage) => {
  return statsPage.evaluate((rowClassName, attributeName, linkClassName, viewStoryText) => {
    // eslint-disable-next-line no-undef
    const [currentRow] = document.getElementsByClassName(rowClassName)
    currentRow.scrollIntoView()
    const rowId = currentRow.getAttribute(attributeName)
    const viewStoryElement = [...currentRow.getElementsByClassName(linkClassName)].find(el => el.innerText === viewStoryText)
    const url = viewStoryElement.getAttribute('href')

    return { rowId, url }
  }, MEDIUM_ROW_CLASS_NAME, MEDIUM_ROW_ID_ATTRIBUTE, STORY_LINK_CLASS_NAME, VIEW_STORY_TEXT)
}

const getNextStory = (statsPage, lastRowId) => {
  return statsPage.evaluate((className, attributeName, lastRowId, linkClassName, viewStoryText) => {
    // eslint-disable-next-line no-undef
    const rows = [...document.getElementsByClassName(className)]
    const lastRowIndex = rows.findIndex(r => r.getAttribute(attributeName) === lastRowId)
    const nextRow = rows[lastRowIndex + 1]
    if (nextRow) {
      nextRow.scrollIntoView()
      const rowId = nextRow.getAttribute(attributeName)
      const viewStoryElement = [...nextRow.getElementsByClassName(linkClassName)].find(el => el.innerText === viewStoryText)
      const url = viewStoryElement.getAttribute('href')

      return { rowId, url }
    }
  }, MEDIUM_ROW_CLASS_NAME, MEDIUM_ROW_ID_ATTRIBUTE, lastRowId, STORY_LINK_CLASS_NAME, VIEW_STORY_TEXT)
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

  let story = await gitFirstStory(statsPage)
  if (startWith) {
    while(story.url !== startWith) {
      story = await getNextStory(statsPage, story.rowId)
      await new Promise(r => setTimeout(r, 200))
      if (!story) {
        console.log('No stories left')
        return
      }
      console.log(`Skipping the story with url=${story.url}`)
    }
  }
  while (story) {
    const storyPage = await browser.newPage()
    await storyPage.goto(story.url)
    try {
    
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
        try {
          await deletePromotionElement(storyPage, lastSection, 'figure')
          await deletePromotionElement(storyPage, lastSection, 'p')
          await storyPage.keyboard.down('Meta')
          await storyPage.keyboard.press('V')
        
          const saveButton = await getElementWithText(storyPage, 'span', SAVE_BUTTON_TEXT)
          await saveButton.click()
          await storyPage.waitForNavigation()
          console.log(`Successfully updated promotion for story with url=${story.url}`)
        } catch (err) {
          console.log(`Skip the story with url=${story.url} because old promotion section has a different format`)
        }
      } else {
        console.log(`Story with url=${story.url} doesn't nave promotion section`)
      }
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch (err) {
      console.log(`Fail to update story with url=${story.url}`)
    }

    await storyPage.close()
    
    story = await getNextStory(statsPage, story.rowId)
  }

  await browser.close()
}

updatePromotionInStories()