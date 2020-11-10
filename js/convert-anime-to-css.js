// currently, all elements that are animated must have an id.
// Add ids if they're missing.

// to be set in const tl:
// autoplay: false,
// loop: false,

// to be added to each timeline section:
// changeBegin: function(anim) { logAnimations(anim) },

let cumulativeTimelineDuration = 0
const targets = {}

const logAnimations = (anim) => {
  const sectionOffset = anim.timelineOffset
  for (const animation of anim.animations) {
    const targetId = animation.animatable.target.id
    // Without an id, keyframes will be written for an empty target.
    // This should probably throw an error, rather than log to the console:
    if (!targetId) console.log('WARNING: missing id property for ' + animation.animatable.target.tagName + ' element in #' + animation.animatable.target.parentNode.id)

    const animatedProperty = animation.property
    const fromValues = []
    const toValues = []

    for (const tween of animation.tweens) {
      const tweenStart = tween.start + tween.delay + sectionOffset
      const tweenEnd = tween.end + sectionOffset

      // anime adds 'px' to strokeDashoffset values for some reason
      if (animatedProperty === 'strokeDashoffset') {
        fromValues.push(tween.from.numbers[0])
        toValues.push(tween.to.numbers[0])
      } else { // otherwise anime's extra formatting (eg. +px, +deg) is quite useful
        fromValues.push(tween.from.original)
        toValues.push(tween.to.original)
      }

      // make a new ruleset for the current target, if there isn't one already
      if (!targets[targetId]) targets[targetId] = { }

      // add an empty keyframe at the tweenStart time, if there isn't a keyframe there already
      if (!targets[targetId][tweenStart]) targets[targetId][tweenStart] = { }

      // add an empty keyframe at the tweenEnd time, if there isn't a keyframe there already
      if (!targets[targetId][tweenEnd]) targets[targetId][tweenEnd] = { }

      const validTransforms = ['translateX', 'translateY', 'translateZ', 'rotate', 'rotateX', 'rotateY', 'rotateZ', 'scale', 'scaleX', 'scaleY', 'scaleZ', 'skew', 'skewX', 'skewY', 'perspective', 'matrix', 'matrix3d']
      // check if animatedProperty is a transform
      if (validTransforms.includes(animatedProperty)) {
        // add a 'transform' object to the starting keyframe, if it doesn't exist yet
        if (!targets[targetId][tweenStart].transform) targets[targetId][tweenStart].transform = { }

        // add the animated property and its value to the transform object, if it doesn't exist yet
        if (!targets[targetId][tweenStart].transform[animatedProperty]) {
          Object.defineProperty(targets[targetId][tweenStart].transform, animatedProperty, {
            value: fromValues[fromValues.length - 1],
            enumerable: true
          })
        }
        // if it does exist already, um, do nothing for now...
        // TODO: find out what is happening if it does exist!

        // add a 'transform' object to the ending keyframe, if it doesn't exist yet
        if (!targets[targetId][tweenEnd].transform) targets[targetId][tweenEnd].transform = { }

        // add the animated property and its value to the transform object, if it doesn't exist yet
        if (!targets[targetId][tweenEnd].transform[animatedProperty]) {
          Object.defineProperty(targets[targetId][tweenEnd].transform, animatedProperty, {
            value: toValues[toValues.length - 1],
            enumerable: true
          })
        }
      } else { // if animatedProperty is not a transform
        // if the current property name isn't found in the starting keyframe, add it, and its starting value
        if (!targets[targetId][tweenStart][animatedProperty]) {
          Object.defineProperty(targets[targetId][tweenStart], animatedProperty, {
            value: fromValues[fromValues.length - 1],
            enumerable: true
          })
        }
        // if the current property name isn't found in the ending keyframe, add it, and its starting value
        if (!targets[targetId][tweenEnd][animatedProperty]) {
          Object.defineProperty(targets[targetId][tweenEnd], animatedProperty, {
            value: toValues[toValues.length - 1],
            enumerable: true
          })
        }
        cumulativeTimelineDuration = Math.round((animation.duration + sectionOffset) * 100 + Number.EPSILON) / 100
        console.log('timeline duration:', cumulativeTimelineDuration)
      }
    }
  }
}

function timelineComplete () {
  console.log('total timeline duration:', cumulativeTimelineDuration)

  const targetIds = Object.keys(targets)

  targetIds.forEach(id => {
    const absoluteKeyframes = Object.keys(targets[id])
    let percentageKeyframe = ''
    // convert absolute time keyframes to percentages
    absoluteKeyframes.forEach(keyframe => {
      percentageKeyframe = Math.round(keyframe / cumulativeTimelineDuration * 100 * 100 + Number.EPSILON) / 100 + '%'

      targets[id][percentageKeyframe] = targets[id][keyframe]
      delete targets[id][keyframe]
    })
    const percentageKeyframes = Object.keys(targets[id])
    // add a 0% & 100% keyframe to each animation so they start in the
    // correct initial position and hold at the end

    // Keyframe -> Number
    const firstKeyframeNumber = (kf) => {
    // takes keyframe string (e.g. '0%, 19%')
    // returns first number in this string as an integer (e.g. 0)
      const first = kf
        .split(',')[0]
        .replace('%', '')
      return Number(first)
    }

    const oldFirstKeyframe = percentageKeyframes[0]
    const oldLastKeyframe = percentageKeyframes[percentageKeyframes.length - 1]
    if (oldFirstKeyframe !== '0%') {
      const newFirstKeyframe = '0%, ' + oldFirstKeyframe
      targets[id][newFirstKeyframe] = targets[id][oldFirstKeyframe]
      delete targets[id][oldFirstKeyframe]
    }
    if (oldLastKeyframe !== '100%') {
      const newLastKeyframe = oldLastKeyframe + ', 100%'
      targets[id][newLastKeyframe] = targets[id][oldLastKeyframe]
      delete targets[id][oldLastKeyframe]
    }
    // build a new keyframes object where the keys are sorted by percentage
    // 0% (or 0,n%) should be first, 100 (or n%, 100%) should be last.
    const sortedKeyframes = Object.keys(targets[id])
      .sort((a, b) => firstKeyframeNumber(a) - firstKeyframeNumber(b))
      .reduce((keyframes, keyframe) => {
        // starting with an empty object, run through each key, in our sorted lisst
        // add it to the obj with the value being that same key in our targets[id]
        // when we are done, we'll have a full sorted object
        return {
          ...keyframes,
          [keyframe]: targets[id][keyframe]
        }
      }, {}) // here be the empty object that starts the reduce loop
    targets[id] = sortedKeyframes
  })

  let animDetails = JSON.stringify(targets)
  // here comes some verbose and repetitive regex!

  // remove quotation marks
  animDetails = animDetails.replace(/['"]+/g, '')
  // wrap transform property values in brackets
  animDetails = animDetails.replace(/(translateX|translateY|translateZ|rotateX|rotateY|rotateZ|rotate|scaleX|scaleY|scaleZ|scale|skewX|skewY|skew|perspective|matrix3d|matrix):(-*[0-9]*\.*[0-9]*[px|deg|%]*),*/g, '$1($2) ')
  // swap transforms' curly brace to a colon
  animDetails = animDetails.replace(/(transform:){/g, '$1 ')
  // add a semicolon to the end of the transform value
  animDetails = animDetails.replace(/\) }/g, ');')
  // remove colons, except in css declarations
  animDetails = animDetails.replace(/:{+/g, '{')
  // find target names, add #, create an animation-name & keyframes declaration
  animDetails = animDetails.replace(/([^{%, .]{2,}){/g, '\n#$1 { animation-name: $1-anim; } \n@keyframes $1-anim {\n  ')
  // find commas in css declarations, replace them with a space
  animDetails = animDetails.replace(/(?<=[a-z0-9]),/g, ' ')
  // add a space to the end of css declarations
  animDetails = animDetails.replace(/(?<=[a-z0-9;])}/g, ' }')
  // separate css declarations with a semicolon
  animDetails = animDetails.replace(/([a-zA-ZĀā]*:[0-9][0-9]*\.*[0-9]*[px|deg|%]* *[0-9]*\.*[0-9]*[px|deg|%]* *[0-9]*\.*[0-9]*[px|deg|%]*)/g, '$1; ')
  animDetails = animDetails.replace(/ ;/g, ';')
  // remove commas after closing curly braces or semicolons
  animDetails = animDetails.replace(/(}|;),/g, '$1')
  // add spaces to keyframe declarations
  animDetails = animDetails.replace(/%{/g, '% { ')
  // separate two closing braces with a newline
  animDetails = animDetails.replace(/}}/g, '}\n}')
  // separate keyframes with a newline
  animDetails = animDetails.replace(/}([0-9])/g, '}\n  $1')
  // camelCase to kebab-case
  // separate words with hyphen (don't include X/Y/Z transforms)
  animDetails = animDetails.replace(/([a-z])([A-W])/g, '$1-$2')
  // TODO: lowercase only the previous match, not the whole string
  // animDetails.toLowerCase()
  // remove enclosing curly braces
  animDetails = animDetails.substring(1, animDetails.length - 1)

  targetIds.forEach((id, index) => { targetIds[index] = '#' + id })
  const selectorList = targetIds.toString()
  const durationTimingDeclaration = ' {\n\tanimation-duration:' + cumulativeTimelineDuration + 'ms;\n\tanimation-timing-function: ease-in-out;\n\tanimation-iteration-count: infinite;\n}\n'
  const cssAnimations = selectorList + durationTimingDeclaration + animDetails

  console.log('CSS animations: ', cssAnimations)
}

tl.finished.then(timelineComplete)
tl.play()
