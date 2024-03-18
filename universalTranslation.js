import https from "node:https";
import { StringDecoder } from "node:string_decoder";
import MD5 from "./niversalTranslation_md5.js";
import { writeFile, readdir } from "fs/promises";
import path from "node:path";
import xlsx from "node-xlsx";
import configD from "./config.js";
import { mkdir } from "node:fs";

const decoder = new StringDecoder("utf8");

const paramsToQuery = (paramsObject, url) => {
  const queryArr = [];
  Object.keys(paramsObject).forEach((key) => {
    queryArr.push(
      `${encodeURIComponent(key)}=${encodeURIComponent(paramsObject[key])}`
    );
  });
  const queryString =
    queryArr.length > 0 ? `${url}?${queryArr.join("&")}` : url;
  return queryString;
};

const fileNameToJsName = {
  "menu.js": "菜单",
  "mapList.js": "路径地图列表",
  "home2d.js": "路径地图规划、实时监控",
  "slamMap.js": "导航地图",
  "vehicle.js": "AGV",
  "work.js": "任务",
  "flow.js": "流程管理",
  "chargeStation.js": "充电桩",
  "simulation.js": "仿真管理",
  "account.js": "账户管理",
  "application.js": "申请管理",
  "scence.js": "场景",
  "service.js": "服务管理",
  "hmi.js": "HMI 车端",
  others: "其他",
};

// 停
const sleep = (time) =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(true);
    }, time || 1000);
  });

// 相对位置
const relativePath = (absolutePath) => {
  return path.relative(process.cwd(), absolutePath);
};
// 加载文件
export const importFile = (pathFolder, file) =>
  new Promise((resolve, reject) => {
    const importPath = relativePath(path.join(pathFolder, file));
    import(`./${importPath}`)
      .then((result) => {
        resolve(result?.default);
      })
      .catch((error) => {
        console.log(error);
        reject(error);
      });
  });

const variableOut_ = /(\{[a-zA-Z0-9]+\})/g;
const variableOut_Re_sample = "[(#)]";

/**
 * @translate 要翻译的产物
 * {
 *      to:string,    //翻译语言类型
 *      folder:string, //翻译后的文件目录
 *      from?:string, //默认是中文
 * }[]
 *
 * @localsBaseTargetFloder locals文件的目录
 * @baseFolderName 中文目录文件夹名称
 */
export class UniversalTranslation {
  /**
   
   * type translateType={to:string,folder:string,from?:string}[]
   * */
  constructor({ translate, localsBaseTargetFloder, baseFolderName = "zh-CN" }) {
    this.valueKeyMap = {};
    this.strHadReplace = {};
    this.translate = translate;
    this.localsBaseTargetFloder = localsBaseTargetFloder;
    this.baseFolderName = baseFolderName;
    this.filesArray = [];
    this.indexFileGeneration = undefined;
  }

  translateFileMuti = async () => {
    const files = await readdir(
      path.join(this.localsBaseTargetFloder, this.baseFolderName)
    );

    const filesJs = files?.filter((v) => !!v?.match(/^.*\.js$/g));
    this.filesArray = [...filesJs];

    for (let i = 0, filesJsLen = filesJs?.length ?? 0; i < filesJsLen; i++) {
      const tempI = filesJs[i];
      await this.translateFile(tempI);
      console.log(`>..____________${i}、 FINISH   ${tempI}  _____________]]`);
    }

    await this.turnIntoExcel();
  };

  /** 将翻译过的文档转成Excel */
  turnIntoExcel = async () => {
    for (let i = 0, transLen = this.translate?.length ?? 0; i < transLen; i++) {
      const { to, floder } = this.translate[i] || {};
      if (!to || !floder) continue;
      const files = await readdir(
        path.join(this.localsBaseTargetFloder, floder)
      );
      const filesJs = files?.filter((v) => !!v?.match(/^.*\.js$/g));
      const arrIn = [];
      let othersOMG = {};
      for (let i = 0, filesJsLen = filesJs?.length ?? 0; i < filesJsLen; i++) {
        const tempI = filesJs[i];
        const fileNameGive = fileNameToJsName[tempI];
        const fileData = await importFile(
          path.join(this.localsBaseTargetFloder, floder),
          tempI
        );
        if (fileNameGive) {
          arrIn.push({
            tabName: fileNameGive,
            data: { ...fileData },
          });
        } else {
          othersOMG = {
            ...othersOMG,
            ...fileData,
          };
        }
      }
      arrIn.push({
        tabName: fileNameToJsName["others"],
        data: { ...othersOMG },
      });
      await this.fileOutXlsx(arrIn, to);

      // 生成locals导出文件
      const indexPageStr = this.generationIndexFile(floder);
      await this.writeJsFiles(
        path.join(this.localsBaseTargetFloder, `${floder}.js`),
        indexPageStr
      );
    }
  };

  translateFile = async (file) => {
    const fileData = await importFile(
      path.join(this.localsBaseTargetFloder, this.baseFolderName),
      file
    );
    if (!fileData) return;
    const keySrcObject = {};
    const queryArray = [];

    Object.keys(fileData).forEach((key) => {
      const keyV = fileData[key]?.trim?.(); //this.relaceVariableBeForeTranslate(fileData[key], key);
      if (!keyV || !key) {
        return;
      }
      if (!keySrcObject[keyV]) {
        keySrcObject[keyV] = [];
      }
      keySrcObject[keyV].push(key);
      queryArray.push(keyV);
    });
    const queryString = queryArray.join("\n");
    this.valueKeyMap = { ...keySrcObject };
    const translateLen = this.translate?.length ?? 0;

    const filesLocal = await readdir(this.localsBaseTargetFloder);
    const hadNew = {};
    for (let i = 0; i < translateLen; i++) {
      const tempTranslateI = this.translate[i];
      const { to, floder, from = "zh", keep } = tempTranslateI || {};
      if (!to || !floder) continue;
      if (!filesLocal.includes(floder) && !hadNew[floder]) {
        const folderPath = path.join(this.localsBaseTargetFloder, floder);
        mkdir(folderPath, { recursive: true }, (err) => {
          if (err) throw err;
        });
        await sleep(1000);
        hadNew[floder] = true;
      }
      await this.dataTranslateIntoFile({
        to,
        file,
        floder: floder,
        query: queryString,
        from,
        keep,
      });
      await sleep(200);
    }
  };

  dataTranslateIntoFile = async ({ to, file, floder, query, from, keep }) => {
    try {
      const translateRes = await this.requestTranslate({
        query: query,
        to: to,
        from,
      });
      const translateResParse = JSON.parse(translateRes);
      if (translateResParse?.error_code) {
        throw { ...translateResParse };
      }
      const trans_result_after = translateResParse.trans_result;
      const codeStr = this.translateGoto(trans_result_after, to, keep);

      if (!codeStr) return;
      const writeFilePath = path.join(
        this.localsBaseTargetFloder,
        floder,
        file || `${Date.now()}.js`
      );
      await this.writeJsFiles(writeFilePath, codeStr);
    } catch (err) {
      console.error("=====***** dataTranslateIntoFile ****==========", err);
    }
  };

  /** 翻译 */
  requestTranslate = ({ query, to, from = "zh" }) =>
    new Promise((resolve, reject) => {
      const appid = configD.appid;
      const key = configD.key;
      const salt = `${new Date().getTime()}`;
      const fromV = from || "zh";
      var str1 = appid + query + salt + key;
      var sign = MD5(str1);
      const data = {
        q: query,
        appid: appid,
        salt: salt,
        from: fromV,
        to: to,
        sign: sign,
      };
      const pathWithParams = paramsToQuery(data, "/api/trans/vip/translate");
      const options = {
        hostname: "api.fanyi.baidu.com",
        port: 443,
        path: pathWithParams,
        method: "GET",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      };
      let dataFianl = "";
      const req = https.request(options, (res) => {
        res.on("data", (d) => {
          const backD = decoder.write(d);
          dataFianl += backD;
        });
        res.on("end", () => {
          if (!res.complete) {
            reject(
              ' "The connection was terminated while the message was still being sent"'
            );
          } else {
            resolve(dataFianl);
          }
        });
      });

      req.on("error", (e) => {
        reject(e);
      });

      req.end();
    });

  /** 写入文件 */
  writeJsFiles = (relativePath, codeStr) =>
    writeFile(path.resolve(process.cwd(), relativePath), codeStr);

  /**  整理写入js文件的内容*/
  translateGoto = (tranArr, to, keep) => {
    if (!Array.isArray(tranArr)) return;
    const arrLen = tranArr?.length;
    const fileBase = {};
    for (let i = 0; i < arrLen; i++) {
      const tempI = tranArr[i];
      if (!tempI) continue;
      const { dst, src } = tempI;
      const keyUArr = this.valueKeyMap[src];
      for (let j = 0, keyUArrLen = keyUArr?.length ?? 0; j < keyUArrLen; j++) {
        const keyUJ = keyUArr[j];
        if (!keyUJ) continue;
        fileBase[keyUJ] =
          keep?.[keyUJ] ||
          (to === "en" ? dst.charAt(0).toUpperCase() + dst.slice(1) : dst); //this.restorationVariableAfterTranslate(dst, keyU);
      }
    }
    const finalStr = `export default ${JSON.stringify(fileBase)}`;
    return finalStr;
  };

  /** 索引文件内容 */
  generationIndexFile = (folder) => {
    const filesLen = this.filesArray?.length ?? 0;
    if (filesLen < 1) return;
    let importStr = "";
    let exportDefaultStr = "";
    for (let i = 0; i < filesLen; i++) {
      const filesI = this.filesArray[i];
      const fileName = filesI.replace(".js", "");
      importStr += `import ${fileName} from "./${folder}/${filesI}";\n`;
      exportDefaultStr += ` ...${fileName},\n`;
    }
    return `${importStr}\nexport default { \n ${exportDefaultStr} \n}`;
  };

  /** 替换变量部分（不需要翻译的） */
  relaceVariableBeForeTranslate = (str, key) => {
    const metchArr = str?.match(variableOut_);
    const metchArrLen = metchArr?.length ?? 0;
    let strFinal = str;
    if (metchArrLen > 0) {
      const variableObject = [];
      for (let i = 0; i < metchArrLen; i++) {
        const tempO = metchArr[i];
        const tempRe = `__@${new Array(i + 1)
          .fill(variableOut_Re_sample)
          .join("*")}@__`;
        strFinal = strFinal.replace(tempO, tempRe);
        variableObject.push({
          str: strFinal,
          replacePart: tempRe,
        });
      }
      this.strHadReplace[key] = [...variableObject];
    }
    return strFinal;
  };
  /** 翻译结束后，将不需要翻译的部分换回来 */
  restorationVariableAfterTranslate = (stRe, key) => {
    const replacedStr = this.strHadReplace[key];
    const replacedStrLen = replacedStr?.length ?? 0;
    let strFinal = stRe;
    if (replacedStrLen > 0) {
      for (let i = 0; i < replacedStrLen; i++) {
        const tempI = replacedStr[i];
        const { replacePart, str } = tempI || {};
        if (!replacePart || !str) continue;
        strFinal = strFinal.replace(replacePart, str);
      }
    }
    return strFinal;
  };

  /** 整理excel内容 */
  fileOutXlsx = async (arryin, to) => {
    const dataLen = arryin.length;
    const dataFinal = [];
    const hassame = {};
    const same = [];
    const chineseWord = await importFile(
      this.localsBaseTargetFloder,
      `${this.baseFolderName}.js`
    );
    for (let i = 0; i < dataLen; i++) {
      const dataTemp = [["KEY", "中文", "翻译"]];
      const tempI = arryin[i];
      const name = tempI?.tabName;
      if (!name) continue;
      const dataKo = tempI?.data;
      Object.keys(dataKo).forEach((key) => {
        if (key) {
          const words = dataKo[key];
          if (!hassame[words]) {
            hassame[words] = 1;
          } else {
            same.push({ page: name, words });
          }
          dataTemp.push([key, chineseWord[key], words]);
        }
      });
      dataFinal.push({
        name,
        data: dataTemp,
      });
    }
    var buffer = xlsx.build(dataFinal);

    await writeFile(
      path.join(process.cwd(), "outExcel", `intl_${to || Date.now()}.xlsx`),
      buffer
    );
  };
}
