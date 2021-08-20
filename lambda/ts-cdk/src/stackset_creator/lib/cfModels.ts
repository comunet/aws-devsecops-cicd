export module CFEnvironmentParameters {
  export class CFParams {
    env: CFEnvParameterProperty[];
  }
  export class CFEnvParameterProperty {
    environmentType: string;
    environmentFriendlyName: string;
    retainStacksOnAccountRemoval: string;
    params: CFParameterProperty[];
  }
  export class CFParameterProperty {
    parameterUniqueKey: string;
    parameterKey: string;
    parameterValue: string;
  }
  export function ConvertCFParameterListToRecords(p_params: CFParameterProperty[])
  {
    type cfParam = Record<string, string>;
    let l_params: cfParam = {};
    for(let l_record in p_params){
      console.log(`param is: ${p_params[l_record].parameterKey}`);
      l_params[p_params[l_record].parameterKey] = p_params[l_record].parameterValue;
    }
    return l_params
  }
}
