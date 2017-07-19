import { animate } from '../../src/main'
import * as chai from 'chai'
const { assert } = chai

describe('timeline.add()', () => {
  it('adds no offset at 0', () => {
    const target = document.createElement('div')
    document.body.appendChild(target)

    const timeline = animate()
      .add({
        targets: target,
        duration: 1000,
        props: [
          { opacity: 0 },
          { opacity: 1 }
        ]
      })
    
    timeline.pause()
    
    assert.equal(timeline.duration, 1000)
    
    timeline.currentTime = 0
    assert.approximately(+getComputedStyle(target).opacity, 0, .0001)
    
    timeline.currentTime = 500
    assert.approximately(+getComputedStyle(target).opacity, .5, .0001)
    
    timeline.currentTime = 1000
    assert.approximately(+getComputedStyle(target).opacity, 1, .0001)
  });
  
  it('adds no offset at 0', () => {
    const target = document.createElement('div')
    document.body.appendChild(target)

    const timeline = animate()
      .add({
        targets: target,
        from: 500,
        duration: 1000,
        props: [
          { opacity: 0 },
          { opacity: 1 }
        ]
      })
    
    timeline.pause()
      
    assert.equal(timeline.duration, 1500)

    timeline.currentTime = 0
    assert.approximately(+getComputedStyle(target).opacity, 0, .0001)
    
    timeline.currentTime = 500
    assert.approximately(+getComputedStyle(target).opacity, 0, .0001)
    
    timeline.currentTime = 1000
    assert.approximately(+getComputedStyle(target).opacity, .5, .0001)
    
    timeline.currentTime = 1500
    assert.approximately(+getComputedStyle(target).opacity, 1, .0001)
  });
});
