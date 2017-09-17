import { ITimelineModel } from '../core/types'
import { loopOff } from '../core/timeloop'
import { publish } from './publish'
import { S_INACTIVE, _ } from '../utils/constants'
import { all } from '../utils/lists'
import { CANCEL } from '../actions'
import { IReducer } from '../core/types'

export const cancel: IReducer = (model: ITimelineModel) => {
  // call cancel on all players
  all(model.players, effect => effect.cancel())

  // set state as inactive and clear time, round, and players
  model.state = S_INACTIVE
  model.time = _
  model.round = _
  model.players = _

  // stop auto-updating players
  loopOff(model.id)
  
  // send cancel event
  publish(model, CANCEL, _)
}