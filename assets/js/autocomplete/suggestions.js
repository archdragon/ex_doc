/* globals sidebarNodes */

// Dependencies
// ------------

import * as helpers from '../helpers'

// Constants
// ---------

const resultsCount = 5
const sortingPriority = {
  'Module': 3,
  'Child': 2,
  'Exception': 1,
  'Mix Task': 0
}

/**
 * Checks if given module/function matches the search term.
 *
 * @returns {boolean}
 */
function isMatch (item) {
  return item.match !== item.id
}

/**
 * Get results found returned by search.findIn and transform them into a flat data structure,
 * that can be used in autocomplete.
 *
 * @param {Object} moduleResults results
 */
function parseModuleResults (moduleResults) {
  const functions = moduleResults.functions || []
  let callbacks = moduleResults.callbacks || []
  let types = moduleResults.types || []

  types = addLabel(types, 'type')
  callbacks = addLabel(callbacks, 'callback')

  const results =
    [...functions, ...callbacks, ...types]
      .filter(isMatch)
      .map((item) => serialize(item, moduleResults.id))

  if (isMatch(moduleResults)) {
    const serializedModuleData = serialize(moduleResults, moduleResults.id, false)
    results.unshift(serializedModuleData)
  }

  return results
}

/**
 * Transform an object containing data about a search result and transforms it into a simple
 * data structure that can be used directly in the autocomplete template.
 *
 * @param {Object} item
 * @param {string} moduleId
 * @param {boolean} isChild
 * @returns {Object} Serialized object that can be used directly in the autocomplete template.
 */
function serialize (item, moduleId, isChild = true) {
  const anchor = isChild ? item.anchor : ''
  const category = isChild ? 'Child' : item.category
  const description = isChild ? moduleId : null
  const label = item.label || null
  const link = anchor ? `${moduleId}.html#${anchor}` : `${moduleId}.html`

  return {
    link: link, // Link to the result. Used in the 'href' tag.
    title: item.match, // Main text displayed for each autocomplete result.
    description: description, // Displayed under the title.
    label: label, // 'Callback' or 'Type' - if set it will be displayed next to the title.
    category: category
    // 'Module', 'Mix Task', 'Exception' or 'Child'.
    // Used to sort the results according to the 'sortingPriority'.
    // 'Child' means an item that belongs to a module (like Function, Callback or Type).
  }
}

/**
 * @param {string} [term=''] Text we want to search for.
 *
 * @returns {Object[]} sorted results of the search.
 */
function getSuggestions (term = '') {
  if (term.trim().length === 0) {
    return []
  }

  const nodes = sidebarNodes

  let modules = findIn(nodes.modules, term)
  let exceptions = findIn(nodes.exceptions, term)
  let tasks = findIn(nodes.tasks, term)

  modules = addCategory(modules, 'Module')
  exceptions = addCategory(exceptions, 'Exception')
  tasks = addCategory(tasks, 'Mix Task')

  let results = [...modules, ...exceptions, ...tasks]

  results = results.reduce(function (acc, moduleResults) {
    return acc.concat(parseModuleResults(moduleResults))
  }, [])

  results.sort(function (item1, item2) {
    const weight1 = sortingPriority[item1.category] || -1
    const weight2 = sortingPriority[item2.category] || -1

    return weight2 - weight1
  })

  return results.slice(0, resultsCount)
}

/**
 * @param {Object[]} items Array of objects containing information about Functions, Types or Callbacks.
 * @param {string} labelName Name of the label that will be added to all items.
 *
 * @returns {Object[]} Array of objects, where each object has an 'label' attribute set to 'labelName'.
 */
function addLabel (items, labelName) {
  return items.map((item) => {
    item.label = labelName
    return item
  })
}

/**
 * @param {Object[]} items Array of modules.
 * @param {string} categoryName Name of the category that will be added to all modules.
 *
 * @returns {Object[]} Array of objects, where each object has an 'category' attribute set to 'categoryName'.
 */
function addCategory (modules, categoryName) {
  return modules.map((module) => {
    module.category = categoryName
    return module
  })
}

function findIn (elements, term) {
  const matcher = new RegExp(helpers.escapeText(term), 'i')

  return elements.map(function (element) {
    let title = element.title
    let titleMatch = title && title.match(matcher)
    let result = {
      id: element.id,
      match: titleMatch ? highlight(titleMatch) : element.title
    }
    let hasMatch = !!titleMatch

    if (element.nodeGroups) {
      for (let {key, nodes} of element.nodeGroups) {
        let matches = findNested(nodes, title, matcher, term, result[key])
        if (Object.keys(matches).length > 0) {
          hasMatch = true
          if (key === 'types' || key === 'callbacks') {
            result[key] = matches
          } else {
            result.functions = matches
          }
        }
      }
    }

    if (hasMatch) {
      for (let key in result) {
        if (key !== 'id' && key !== 'match') {
          result[key] = Object.values(result[key]).sort((a, b) => a.id.localeCompare(b.id))
        }
      }

      return result
    }
  }).filter((element) => !!element)
}

function highlight (match) {
  return match.input.replace(match, `<em>${match[0]}</em>`)
}

function findNested (elements, parentId, matcher, term, acc) {
  return (elements || []).reduce((acc, element) => {
    if (acc[element.id]) { return acc }

    // Match things like module.func
    const fullTitle = `${parentId}.${element.id}`
    var fullTitleMatch = !(parentId + '.').match(matcher) && fullTitle.match(matcher)
    var match = element.id && element.id.match(matcher)
    var result = JSON.parse(JSON.stringify(element))

    if (match) {
      result.match = highlight(match)
    } else if (fullTitleMatch) {
      term = term.split('.').pop()
      const matcherWithoutParent = new RegExp(helpers.escapeText(term), 'i')
      const matchWithoutParent = element.id && element.id.match(matcherWithoutParent)
      result.match = highlight(matchWithoutParent)
    } else {
      result.match = element.id
    }
    acc[result.id] = result

    return acc
  }, acc || {})
}

// Public Methods
// --------------

export { getSuggestions }
