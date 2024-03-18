import { UniversalTranslation, importFile } from "./universalTranslation.js";
import path from "path";
import fse from "fs-extra";
import fs from "node:fs";

const LOCALES_ZH_PATH = "./src/locales";

// 定义源文件夹路径和目标文件夹路径
const sourceFolderPath = "/path/to/source"; // 源文件夹路径
const targetFolderPath = "/path/to/target"; // 目标文件夹路径

// console.log(process.argv);

// 获取当前工作目录（绝对路径）
const currentDirectory = process.cwd();
const absolutePath = path.join(
  "D:",
  "workSpace",
  "project",
  "SaaSCome",
  "1.2",
  "lianhe-saas-web",
  "src",
  "locales"
);

// 将要翻译的目录复制到同级目录下（文件夹）
const copyFileInOneFolder = ({ sourceFolderPath, targetFolderPath }) =>
  new Promise((resolve, reject) => {
    fse
      .copy(sourceFolderPath, targetFolderPath)
      .then(() => {
        console.log("文件夹复制成功！");
        resolve(true);
      })
      .catch((err) => {
        console.error("文件夹复制失败：", err);
        reject(err);
      });
  });

// 将要翻译的目录复制到同级目录下(单文件)
const copyFileInOneFile = ({ sourceFolderPath, targetFolderPath }) =>
  new Promise((resolve, reject) => {
    // 创建读取流并将其写入到目标文件
    const readStream = fs.createReadStream(sourceFolderPath);
    readStream.pipe(fs.createWriteStream(targetFolderPath));

    // 当所有数据被写入后关闭读取流
    readStream.on("end", () => {
      console.log("文件已成功复制！");
      resolve(true);
    });

    // 处理错误情况
    readStream.on("error", (err) => {
      console.error(`发生了错误：${err}`);
      reject(err);
    });
  });

async function initTranslate() {
  const file1Source = path.join(absolutePath, "zh-CN.js");
  const file1Target = path.join(currentDirectory, "locals", "zh-CN.js");
  await copyFileInOneFile({
    sourceFolderPath: file1Source,
    targetFolderPath: file1Target,
  });

  const folderSource = path.join(absolutePath, "zh-CN");
  const folderTarget = path.join(currentDirectory, "locals", "zh-CN");
  await copyFileInOneFolder({
    sourceFolderPath: folderSource,
    targetFolderPath: folderTarget,
  });

  const pathFils = path.join(currentDirectory, "locals");

  const enKeep = await importFile(path.join(process.cwd(), "keep"), "en.js");
  const jpKeep = await importFile(path.join(process.cwd(), "keep"), "jp.js");

  const translate = [
    { to: "en", floder: "en-US", keep: enKeep },
    { to: "jp", floder: "ja", keep: jpKeep },
  ];
  let translateIns = new UniversalTranslation({
    translate: translate,
    localsBaseTargetFloder: pathFils,
  });
  await translateIns.translateFileMuti();
  translateIns = null;

  const translateLen = translate?.length ?? 0;
  for (let i = 0; i < translateLen; i++) {
    const { floder } = translate[i];
    if (!floder) continue;
    const file1Source = path.join(currentDirectory, "locals", `${floder}.js`);
    const file1Target = path.join(absolutePath, `${floder}.js`);
    await copyFileInOneFile({
      sourceFolderPath: file1Source,
      targetFolderPath: file1Target,
    });

    const folderSource = path.join(currentDirectory, "locals", floder);
    const folderTarget = path.join(absolutePath, floder);
    await copyFileInOneFolder({
      sourceFolderPath: folderSource,
      targetFolderPath: folderTarget,
    });
  }
}

initTranslate();
