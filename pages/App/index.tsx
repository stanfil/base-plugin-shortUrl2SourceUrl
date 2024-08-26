'use client'
// import { bitable, ITableMeta } from "@lark-base-open/js-sdk";
// import { Button, Form } from '@douyinfe/semi-ui';
// import { useState, useEffect, useRef, useCallback } from 'react';
// import { BaseFormApi } from '@douyinfe/semi-foundation/lib/es/form/interface';
import styles from './index.module.css';

// export default function App() {
//   const [tableMetaList, setTableMetaList] = useState<ITableMeta[]>();
//   const formApi = useRef<BaseFormApi>();
//   const addRecord = useCallback(async ({ table: tableId }: { table: string }) => {
//     if (tableId) {
//       const table = await bitable.base.getTableById(tableId);
//       table.addRecord({
//         fields: {},
//       });
//     }
//   }, []);
//   useEffect(() => {
//     Promise.all([bitable.base.getTableMetaList(), bitable.base.getSelection()])
//       .then(([metaList, selection]) => {
//         setTableMetaList(metaList);
//         formApi.current?.setValues({ table: selection.tableId });
//       });
//   }, []);

//   return (
//     <main className={styles.main}>
//       <h4 className={styles.h4}>
//         Edit <code className={styles.code}>src/App.tsx</code> and save to reload
//       </h4>
//       <Form labelPosition='top' onSubmit={addRecord} getFormApi={(baseFormApi: BaseFormApi) => formApi.current = baseFormApi}>
//         <Form.Slot label="Development guide">
//           <div>
//             <a href="https://lark-technologies.larksuite.com/docx/HvCbdSzXNowzMmxWgXsuB2Ngs7d" target="_blank"
//               rel="noopener noreferrer">
//               Base Extensions Guide
//             </a>
//             、
//             <a href="https://bytedance.feishu.cn/docx/HazFdSHH9ofRGKx8424cwzLlnZc" target="_blank"
//               rel="noopener noreferrer">
//               多维表格插件开发指南
//             </a>
//           </div>
//         </Form.Slot>
//         <Form.Slot label="API">
//           <div>
//             <a href="https://lark-technologies.larksuite.com/docx/Y6IcdywRXoTYSOxKwWvuLK09sFe" target="_blank"
//               rel="noopener noreferrer">
//               Base Extensions Front-end API
//             </a>
//             、
//             <a href="https://bytedance.feishu.cn/docx/HjCEd1sPzoVnxIxF3LrcKnepnUf" target="_blank"
//               rel="noopener noreferrer">
//               多维表格插件API
//             </a>
//           </div>
//         </Form.Slot>
//         <Form.Select field='table' label='Select Table' placeholder="Please select a Table" style={{ width: '100%' }}>
//           {
//             Array.isArray(tableMetaList) && tableMetaList.map(({ name, id }) => {
//               return (
//                 <Form.Select.Option key={id} value={id}>
//                   {name}
//                 </Form.Select.Option>
//               );
//             })
//           }
//         </Form.Select>
//         <Button theme='solid' htmlType='submit'>Add Record</Button>
//       </Form>
//     </main>
//   )
// }

import { bitable, ITableMeta, IFieldMeta, Selection, FieldType, IOpenUrlSegment, IOpenSegmentType } from "@lark-base-open/js-sdk";
import { Button, Form } from '@douyinfe/semi-ui';
import { BaseFormApi } from '@douyinfe/semi-foundation/lib/es/form/interface';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Tag, Space } from '@douyinfe/semi-ui';
import '../locales/i18n'; // 取消注释以启用国际化
// import { genZodiacSign } from './uitls'
const REQUEST_BATCH_SIZE = 10;

export default function App() {
  const { t, i18n } = useTranslation();
  const [tableMetaList, setTableMetaList] = useState<ITableMeta[]>();
  const [fieldMetaList, setFieldMetaList] = useState<IFieldMeta[]>();
  const [fieldValue, setFieldValue] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)


  const formApi = useRef<BaseFormApi>();

  useEffect(() => {
    Promise.all([bitable.base.getTableMetaList(), bitable.base.getSelection(), bitable.base.getActiveTable()])
      .then(async ([metaList, selection, activeTable]) => {
        const { tableId, fieldId } = selection;
        setTableMetaList(metaList);
        const fieldMetaList = (await activeTable.getFieldMetaListByType(FieldType.Text))
          .concat(await activeTable.getFieldMetaListByType(FieldType.Url))

        setFieldMetaList(fieldMetaList);

        // const fieldMeta = fieldId ? await activeTable.getFieldMetaById(fieldId) : null;
        // const isDateTimeField = fieldMeta?.type === FieldType.DateTime;
        formApi.current?.setValues({
          table: tableId,
          // field: isDateTimeField ? fieldId : null
        });
      });
  }, []);

  useEffect(() => {
    const off = bitable.base.onSelectionChange(async (event: { data: Selection }) => {
      const { tableId, fieldId } = event.data;

      if (tableId === formApi.current?.getValue('table')) return;

      const table = await bitable.base.getActiveTable();
      const fieldMetaList = (await table.getFieldMetaListByType(FieldType.Text))
        .concat(await table.getFieldMetaListByType(FieldType.Url))

      setFieldMetaList(fieldMetaList);
      setFieldValue(null)
      // const fieldMeta = fieldId ? await table.getFieldMetaById(fieldId) : null;
      // const isDateTimeField = fieldMeta?.type === FieldType.DateTime;

      formApi.current?.setValues({
        table: tableId,
        field: null,
        // field: isDateTimeField ? fieldId : null
      });
    })

    return () => { off?.() }
  }, [bitable])

  const gen = useCallback(async () => {
    setLoading(true);

    const selectedTable = formApi.current?.getValue('table')
    const table = await bitable.base.getTableById(selectedTable);
    const fieldId = formApi.current?.getValue('field')
    const fieldMetaList = await table.getFieldMetaList()
    const newField = fieldMetaList?.filter(item => item.name === t('newField'))?.[0]
    const newFieldId = newField?.id || await table.addField({
      type: FieldType.Url,
      name: t('newField')
    })

    const records = (await table.getRecords({ pageSize: 5000 })).records
      .map(r => ({
        recordId: r.recordId,
        url: (r.fields[fieldId] as IOpenUrlSegment[])?.find(seg => seg.type === IOpenSegmentType.Url)?.link
      }))
      .filter(r => !!r.url)

    console.log('records', records);

    const batchCount = Math.ceil(records.length / REQUEST_BATCH_SIZE);

    for (let i = 0; i < batchCount; i++) {
      const urls = records.slice(i * REQUEST_BATCH_SIZE, (i+1) * REQUEST_BATCH_SIZE)
      const result = await request(urls) as Record<string, string | null>

      const updatedRecords = Object.entries(result).map(([recordId, url]) => (url ? {
        recordId,
        fields: {
          [newFieldId]:
            [{
              type: IOpenSegmentType.Url,
              text: url,
              link: url,
            }]
        },
      }: null)).filter(it => !!it)

      await table.setRecords(
        updatedRecords!
      )
    }

    setLoading(false)

    // const updatedRecords = records.map((record, i) => {
    //   const val = record.fields[fieldId] as number | null
    //   if (typeof val !== 'number') return null;

    //   const xingzuo = genZodiacSign(val, i18n.language)
    //   return {
    //     recordId: record.recordId,
    //     fields: {
    //       [newFieldId]: xingzuo,
    //     },
    //   }
    // }).filter(item => !!item) as { recordId: string; fields: { [x: string]: any; }; }[]

    // await table.setRecords(
    //   updatedRecords
    // )
  }, [bitable, setLoading])

  const request = async (urls: { recordId: string, url: string }[]) => {
    try {
      const response = await fetch('/api/expand', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shortUrls: urls }),
      });

      const data = await response.json();
      return data as Record<string, string>;
    } catch (error) {
      console.error('Failed to expand URLs:', error);
      return null
    }
  };



  return (
    <main className={styles.main}>
      <h2 className={styles.h2}>
        {t('title')}
      </h2>
      <br />
      <p>1. {t('step1')}</p>
      <br />
      <p>2. {t('step2')}</p>
      <br />
      <p>3. {t('step3')}</p>
      <br />
      <Space>
        <Tag size="small" color='red'>{t('tips')}</Tag>
      </Space>
      <br />
      <Form labelPosition='top' onSubmit={gen} getFormApi={(baseFormApi: BaseFormApi) => formApi.current = baseFormApi}>
        <Form.Select field='table' label={t('selectTable')} style={{ width: '100%' }}>
          {
            Array.isArray(tableMetaList) && tableMetaList.map(({ name, id }) => {
              return (
                <Form.Select.Option key={id} value={id}>
                  {name}
                </Form.Select.Option>
              );
            })
          }
        </Form.Select>
        <Form.Select field='field' label={t('selectField')} onChange={setFieldValue} style={{ width: '100%' }}>
          {
            Array.isArray(fieldMetaList) && fieldMetaList.map(({ name, id }) => {
              return (
                <Form.Select.Option key={id} value={id}>
                  {name}
                </Form.Select.Option>
              );
            })
          }
        </Form.Select>
        <Button theme='solid' disabled={!fieldValue} loading={loading} htmlType='submit'>{t('genSign')}</Button>
      </Form>
      <br />
    </main>
  )
}
