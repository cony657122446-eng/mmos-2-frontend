import React from 'react';
import {FinancePage as Workspace} from './FinanceWorkspacePage';
import {FinanceBankJournal} from './FinanceBankJournal';
import {FinanceParttime} from './FinanceParttime';
export function FinancePage(props){return props.page==='finance-journal'?<FinanceBankJournal {...props}/>:props.page==='finance-settlement'?<FinanceParttime {...props}/>:<Workspace {...props}/>;}
