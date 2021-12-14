import { Loader, Modal, FormComposer } from "@egovernments/digit-ui-react-components";
import React, { useState, useEffect } from "react";
import { useQueryClient } from "react-query";

import { configBPAApproverApplication } from "../config";
import * as predefinedConfig from "../config";

const Heading = (props) => {
  return <h1 className="heading-m">{props.label}</h1>;
};

const Close = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FFFFFF">
    <path d="M0 0h24v24H0V0z" fill="none" />
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
  </svg>
);

const CloseBtn = (props) => {
  return (
    <div className="icon-bg-secondary" onClick={props.onClick}>
      <Close />
    </div>
  );
};

const ActionModal = ({ t, action, tenantId, state, id, closeModal, submitAction, actionData, applicationDetails, applicationData, businessService, moduleCode }) => {
    const mutation1 = Digit.Hooks.obps.useObpsAPI(
      applicationData?.landInfo?.address?.city ? applicationData?.landInfo?.address?.city : tenantId,
      false
    );
  const { data: approverData, isLoading: PTALoading } = Digit.Hooks.useEmployeeSearch(
    tenantId,
    {
      roles: action?.assigneeRoles?.map?.((e) => ({ code: e })),
      isActive: true,
    },
    { enabled: !action?.isTerminateState }
  );
  const { isLoading: financialYearsLoading, data: financialYearsData } = Digit.Hooks.pt.useMDMS(
    tenantId,
    businessService,
    "FINANCIAL_YEARLS",
    {},
    {
      details: {
        tenantId: Digit.ULBService.getStateId(),
        moduleDetails: [{ moduleName: "egf-master", masterDetails: [{ name: "FinancialYear", filter: "[?(@.module == 'TL')]" }] }],
      },
    }
  );

  const queryClient = useQueryClient();
  const [config, setConfig] = useState({});
  const [defaultValues, setDefaultValues] = useState({});
  const [approvers, setApprovers] = useState([]);
  const [selectedApprover, setSelectedApprover] = useState({});
  const [file, setFile] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [error, setError] = useState(null);
  const [financialYears, setFinancialYears] = useState([]);
  const [selectedFinancialYear, setSelectedFinancialYear] = useState(null);

  useEffect(() => {
    if (financialYearsData && financialYearsData["egf-master"]) {
      setFinancialYears(financialYearsData["egf-master"]?.["FinancialYear"]);
    }
  }, [financialYearsData]);

  useEffect(() => {
    setApprovers(approverData?.Employees?.map((employee) => ({ uuid: employee?.uuid, name: employee?.user?.name })));
  }, [approverData]);

  function selectFile(e) {
    setFile(e.target.files[0]);
  }

  useEffect(() => {
    (async () => {
      setError(null);
      if (file) {
        if (file.size >= 5242880) {
          setError(t("CS_MAXIMUM_UPLOAD_SIZE_EXCEEDED"));
        } else {
          try {
            const response = await Digit.UploadServices.Filestorage("PT", file, tenantId?.split(".")[0]);
            if (response?.data?.files?.length > 0) {
              setUploadedFile(response?.data?.files[0]?.fileStoreId);
            } else {
              setError(t("CS_FILE_UPLOAD_ERROR"));
            }
          } catch (err) {
            console.error("Modal -> err ", err);
            setError(t("CS_FILE_UPLOAD_ERROR"));
          }
        }
      }
    })();
  }, [file]);

  const getInspectionDocs = (docs) => {
    let refinedDocs = [];
    docs && docs.map((doc,ind) => {
      refinedDocs.push({
        "documentType":(doc.documentType+"_"+doc.documentType.split("_")[1]).replaceAll("_","."),
        "fileStoreId":doc.fileStoreId,
        "fileStore":doc.fileStoreId,
        "fileName":"",
        "dropDownValues": {
          "value": (doc.documentType+"_"+doc.documentType.split("_")[1]).replaceAll("_","."),
      }
      })
    })
    return refinedDocs;
  }

  const getQuestion = (data) => {
    let refinedQues = [];
    var i;
    for(i=0; i<data?.questionLength; i++)
    {
      refinedQues.push({
        "remarks": data[`Remarks_${i}`],
        "question": data?.questionList[i].question,
        "value": data[`question_${i}`].code,
      })
    }
    return refinedQues;
  }

  const getfeildInspection = (data) => {
    let formdata = [], inspectionOb = [];
    
    if (data?.additionalDetails?.fieldinspection_pending?.length > 0) {
      inspectionOb = data?.additionalDetails?.fieldinspection_pending
    }

    if(data.status == "FIELDINSPECTION_INPROGRESS") {
      formdata = JSON.parse(sessionStorage.getItem("INSPECTION_DATA"));
      formdata?.length > 0 && formdata.map((ob,ind) => {
        inspectionOb.push({
          docs: getInspectionDocs(ob.Documents),
          date: ob.InspectionDate,
          questions: getQuestion(ob),
          time: ob?.InspectionTime,
        })
      })
      inspectionOb = inspectionOb.filter((ob) => ob.docs && ob.docs.length>0);
    } else {
      sessionStorage.removeItem("INSPECTION_DATA")
    }
  
    let fieldinspection_pending = [ ...inspectionOb];
    return fieldinspection_pending;
  }

  const getDocuments = (applicationData) => {
    let documentsformdata = JSON.parse(sessionStorage.getItem("BPA_DOCUMENTS"));
    let documentList = [];
    documentsformdata.map(doc => {
      if(doc?.uploadedDocuments?.[0]?.values?.length > 0) documentList = [...documentList, ...doc?.uploadedDocuments?.[0]?.values];
      if(doc?.newUploadedDocs?.length > 0) documentList = [...documentList, ...doc?.newUploadedDocs]
    });
    return documentList;
  }

  const getPendingApprovals = () => {
    const approvals = Digit.SessionStorage.get("OBPS_APPROVAL_CHECKS");
    const newApprovals = Digit.SessionStorage.get("OBPS_NEW_APPROVALS");
    let result = approvals?.reduce((acc, approval) => approval?.checked ? acc.push(approval?.label) && acc : acc, []);
    result = result?.concat(newApprovals !== null?newApprovals.filter(ob => ob.label !== "").map(approval => approval?.label):[]);
    return result;
  }


  const onSuccess = () => {
    //clearParams();
    queryClient.invalidateQueries("PT_CREATE_PROPERTY");
  };


  function submit(data) {
    let workflow = { action: action?.action, comments: data?.comments, businessService, moduleName: moduleCode };
    applicationData = {
      ...applicationData,
      documents: getDocuments(applicationData),
      additionalDetails: {...applicationData?.additionalDetails, fieldinspection_pending:getfeildInspection(applicationData), pendingapproval: getPendingApprovals() },
       workflow:{
        action: action?.action,
        comment: data?.comments?.length > 0 ? data?.comments : null,
        comments: data?.comments?.length > 0 ? data?.comments : null,
        assignee: !selectedApprover?.uuid ? null : [selectedApprover?.uuid],
        varificationDocuments: uploadedFile
        ? [
          {
            documentType: action?.action + " DOC",
            fileName: file?.name,
            fileStoreId: uploadedFile,
          },
        ]
        : null,
      },
      action: action?.action,
      comment: data?.comments,
      assignee: !selectedApprover?.uuid ? null : [selectedApprover?.uuid],
      wfDocuments: uploadedFile
        ? [
          {
            documentType: action?.action + " DOC",
            fileName: file?.name,
            fileStoreId: uploadedFile,
          },
        ]
        : null,
    };

    const nocDetails = applicationDetails?.nocData?.map(noc => {
      const uploadedDocuments = Digit.SessionStorage.get(noc?.nocType) || [];
      return {
        Noc: {
          ...noc,
          documents: [
            ...(noc?.documents?noc?.documents:[]),
            ...(uploadedDocuments?uploadedDocuments:[])
          ]
        }
      }
    })
    // try{
    //   mutation1.mutate({BPA:applicationData}, {
    //     onSuccess,
    //   });
    // }
    // catch (err) {
    //   console.log(err, "inside ack");
    // }
    submitAction({
      BPA:applicationData
    }, nocDetails);
  }

  // useEffect(()=>{
  //   console.log("success");
  // },[mutation1.isSuccess])

  useEffect(() => {
    if (action) {
      setConfig(
        configBPAApproverApplication({
          t,
          action,
          approvers,
          selectedApprover,
          setSelectedApprover,
          selectFile,
          uploadedFile,
          setUploadedFile,
          businessService,
          assigneeLabel: "WF_ASSIGNEE_NAME_LABEL"
        })
      );
    }
  }, [action, approvers, financialYears, selectedFinancialYear, uploadedFile]);

  return action && config.form ? (
    <Modal
      headerBarMain={<Heading label={t(config.label.heading)} />}
      headerBarEnd={<CloseBtn onClick={closeModal} />}
      actionCancelLabel={t(config.label.cancel)}
      actionCancelOnSubmit={closeModal}
      actionSaveLabel={t(config.label.submit)}
      actionSaveOnSubmit={() => { }}
      formId="modal-action"
      style={{height: "auto", padding: "10px"}}
    >
      {financialYearsLoading ? (
        <Loader />
      ) : (
        <FormComposer
          config={config.form}
          noBoxShadow
          inline
          childrenAtTheBottom
          onSubmit={submit}
          defaultValues={defaultValues}
          formId="modal-action"
        />
      )}
    </Modal>
  ) : (
    <Loader />
  );
};

export default ActionModal;