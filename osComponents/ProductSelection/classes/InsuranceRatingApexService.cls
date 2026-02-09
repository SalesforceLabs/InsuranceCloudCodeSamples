public class InsuranceRatingApexService implements Callable {
    
    private static final String POST_RATING_METHOD = 'postRating';
    private static final String PATCH_RATING_METHOD = 'patchRating';

    /**
     * @description AuraEnabled method for LWC to call POST rating
     * @param postPayloadJson JSON string containing rating request parameters
     * @return Map<String, Object> containing the rating response
     */
    @AuraEnabled
    public static Map<String, Object> postRatingFromLwc(String postPayloadJson) {
        InsuranceRatingApexService service = new InsuranceRatingApexService();
        Map<String, Object> output = new Map<String, Object>();
        Map<String, Object> inputs = new Map<String, Object>();
        
        Map<String, Object> postPayload = (Map<String, Object>) JSON.deserializeUntyped(postPayloadJson);
        inputs.put('postPayload', postPayload);
        
        service.invokeMethod(POST_RATING_METHOD, inputs, output, new Map<String, Object>());
        
        return output;
    }
    
    public Object call(String action, Map<String, Object> args) {
        System.debug('InsuranceRatingApexService: call ' + action);
        
        Map<String, Object> input = (Map<String, Object>) args.get('input');
        Map<String, Object> output = (Map<String, Object>) args.get('output');
        Map<String, Object> options = (Map<String, Object>) args.get('options');

        return invokeMethod(action, input, output, options);
    }     

    public Boolean invokeMethod(
        String methodName,
        Map<String, Object> inputs,
        Map<String, Object> output,
        Map<String, Object> options
    ) {
        Boolean response = false;
        
        System.debug('Insurance Rating Apex Service - Method: ' + methodName);
        
        try {
            if (POST_RATING_METHOD.equals(methodName)) {
                response = createRating(inputs, output, options);
            } else if (PATCH_RATING_METHOD.equals(methodName)) {
                response = reprice(inputs, output, options);
            } else {
                throw new UnsupportedOperationException('this method name is incorrect or not supported');
            }
        } catch (Exception e) {
            response = false;
            output.put('success', false);
            output.put('errorMessage', 'Exception occurred: ' + e.getMessage());
            System.debug(LoggingLevel.ERROR, 'Exception in invokeMethod: ' + methodName + ', Error: ' + e.getMessage());
            System.debug(LoggingLevel.ERROR, 'Stack trace: ' + e.getStackTraceString());
        }
        System.debug('Output from invoke:' + output);
        return response;
    }
    
    private Boolean createRating(Map<String, Object> inputs, Map<String, Object> output, Map<String, Object> options) {
        Map<String, Object> postPayload = (Map<String, Object>) getValueFromMap('postPayload', inputs, options);
        System.debug('Rating post Input: ' + postPayload);
        
        // Handle null postPayload
        if (postPayload == null) {
            output.put('success', false);
            output.put('errorMessage', 'postPayload is required for rating patch');
            output.put('errorType', 'VALIDATION_ERROR');
            return false;
        }
        
        try {
            System.debug('Calling Invocable Action: createInsuranceRating');
            Invocable.Action action = Invocable.Action.createStandardAction('createInsuranceRating');
            
        
            System.debug('RatingInputs::::::::' + postPayload.get('ratingInputs'));
            setInvocationParameter(action, postPayload, 'ratingInputs', true);
            
            action.setInvocationParameter('transactionType', postPayload.get('transactionType'));
            
            setInvocationParameter(action, postPayload, 'additionalFields', true);
            
            action.setInvocationParameter('effectiveDate', postPayload.get('effectiveDate'));
            
            if (postPayload.containsKey('ratingOptions')) {
                System.debug('Options:' + postPayload.get('ratingOptions'));
                Map<String, Object> ratingOptions = (Map<String, Object>) postPayload.get('ratingOptions');
                action.setInvocationParameter('ratingOptions', ratingOptions);
            }
            
            List<Invocable.Action.Result> results = action.invoke();
            
            if (results != null && !results.isEmpty()) {
                Invocable.Action.Result result = results[0];
                
                if (result.isSuccess()) {
                    System.debug('Rating post successfully via Invocable Action');
                    output.put('ratingData', result.getOutputParameters());
                    
                    Map<String, Object> outputParams = result.getOutputParameters();
                    System.debug('Rating post data extracted: ' + outputParams);
                    
                    List<Invocable.Action.Error> actionErrors = result.getErrors();
                    if (actionErrors != null && !actionErrors.isEmpty()) {
                        output.put('success', false);
                        output.put('error', result.getErrors());
                        return false;
                    }                    
                    output.put('success', true);
                    return true;
                    
                } else {
                    List<Invocable.Action.Error> actionErrors = result.getErrors();
                    String errorMessage = 'Rating post Invocable Action failed';
                    
                    if (actionErrors != null && !actionErrors.isEmpty()) {
                        List<String> errorMessages = new List<String>();
                        List<Map<String, Object>> errorDetailsList = new List<Map<String, Object>>();
                        
                        for (Invocable.Action.Error actionError : actionErrors) {
                            errorMessages.add(actionError.getMessage());
                            errorDetailsList.add(new Map<String, Object>{
                                'message' => actionError.getMessage(),
                                'code' => actionError.getCode()
                            });
                        }
                        
                        errorMessage = String.join(errorMessages, '; ');
                        output.put('actionErrors', errorDetailsList);
                    }
                    
                    output.put('success', false);
                    output.put('errorMessage', errorMessage);
                    
                    System.debug(LoggingLevel.ERROR, 'Rating post Invocable Action failed: ' + errorMessage);
                    return false;
                }
                
            } else {
                output.put('success', false);
                output.put('errorMessage', 'Rating post Invocable Action returned null or empty results');
                System.debug(LoggingLevel.WARN, 'Rating post Invocable Action returned null/empty results');
                return false;
            }
            
        } catch (Exception e) {
            String errorMsg = 'Exception: ' + e.getMessage();
            output.put('success', false);
            output.put('errorMessage', errorMsg);
            output.put('errorType', 'EXCEPTION');
            System.debug(LoggingLevel.ERROR, 'Exception while rating post: ' + errorMsg);
            return false;
        }
    } 
    
    
    private Boolean reprice(Map<String, Object> inputs, Map<String, Object> output, Map<String, Object> options) {
        Map<String, Object> patchPayload = (Map<String, Object>) getValueFromMap('patchPayload', inputs, options);
        System.debug('Rating patch Input: ' + patchPayload);
        
        if (patchPayload == null) {
            output.put('success', false);
            output.put('errorMessage', 'patchPayload is required for rating patch');
            output.put('errorType', 'VALIDATION_ERROR');
            return false;
        }
        
        try {
            System.debug('Calling Invocable Action: repriceInsuranceProduct');
            
            Invocable.Action action = Invocable.Action.createStandardAction('repriceInsuranceProduct');
            
            System.debug('Context Id::::::::' + patchPayload.get('contextId'));
            action.setInvocationParameter('contextId', patchPayload.get('contextId'));
        
            System.debug('Updated Nodes::::::::' + patchPayload.get('updatedNodes'));
            setInvocationParameter(action, patchPayload, 'updatedNodes', true);

            System.debug('Added Nodes::::::::' + patchPayload.get('addedNodes'));
            setInvocationParameter(action, patchPayload, 'addedNodes', true);

            System.debug('Deleted Nodes::::::::' + patchPayload.get('deletedNodes'));
            setInvocationParameter(action, patchPayload, 'deletedNodes', true);
            
            if (patchPayload.containsKey('executeRating')) {
                System.debug('Options::::::::' + patchPayload.get('executeRating'));
                action.setInvocationParameter('executeRating', patchPayload.get('executeRating'));
            }
            
            if (patchPayload.containsKey('executeConfigurationRules')) {
                System.debug('Options::::::::' + patchPayload.get('executeConfigurationRules'));
                action.setInvocationParameter('executeConfigurationRules', patchPayload.get('executeConfigurationRules'));
            }
            
            if (patchPayload.containsKey('returnContextJSON')) {
                System.debug('Options::::::::' + patchPayload.get('returnContextJSON'));
                action.setInvocationParameter('returnContextJSON', patchPayload.get('returnContextJSON'));
            }
            
            if (patchPayload.containsKey('returnProductDetails')) {
                System.debug('Options::::::::' + patchPayload.get('returnProductDetails'));
                action.setInvocationParameter('returnProductDetails', patchPayload.get('returnProductDetails'));
            }
            
            if (patchPayload.containsKey('returnRatingResults')) {
                System.debug('Options::::::::' + patchPayload.get('returnRatingResults'));
                action.setInvocationParameter('returnRatingResults', patchPayload.get('returnRatingResults'));
            }
            
            List<Invocable.Action.Result> results = action.invoke();
            
            if (results != null && !results.isEmpty()) {
                Invocable.Action.Result result = results[0];
                
                if (result.isSuccess()) {
                    System.debug('Rating patch successfully via Invocable Action');
                    output.put('ratingData', result.getOutputParameters());
                    
                    Map<String, Object> outputParams = result.getOutputParameters();
                    System.debug('Rating Patch data extracted: ' + outputParams);
                    if (outputParams != null) {
                        if (outputParams.containsKey('contextId')) {
                            output.put('contextId', outputParams.get('contextId'));
                        }
                        if (outputParams.containsKey('contextJSON')) {
                            output.put('contextJSON', outputParams.get('contextJSON'));
                        }
                        if (outputParams.containsKey('pricingResult')) {
                            output.put('pricingResult', outputParams.get('pricingResult'));
                        }
                        if (outputParams.containsKey('ratingResult')) {
                            output.put('ratingResult', outputParams.get('ratingResult'));
                        }
                        if (outputParams.containsKey('productDetails')) {
                            output.put('productDetails', outputParams.get('productDetails'));
                        }
                        
                        System.debug('Rating Patch data extracted: ' + outputParams);
                    }
                    List<Invocable.Action.Error> actionErrors = result.getErrors();
                    if (actionErrors != null && !actionErrors.isEmpty()) {
                        output.put('success', false);
                        output.put('error', result.getErrors());
                        return false;
                    }                    
                    output.put('success', true);
                    return true;
                    
                } else {
                    List<Invocable.Action.Error> actionErrors = result.getErrors();
                    String errorMessage = 'Rating Patch Invocable Action failed';
                    
                    if (actionErrors != null && !actionErrors.isEmpty()) {
                        List<String> errorMessages = new List<String>();
                        List<Map<String, Object>> errorDetailsList = new List<Map<String, Object>>();
                        
                        for (Invocable.Action.Error actionError : actionErrors) {
                            errorMessages.add(actionError.getMessage());
                            errorDetailsList.add(new Map<String, Object>{
                                'message' => actionError.getMessage(),
                                'code' => actionError.getCode()
                            });
                        }
                        
                        errorMessage = String.join(errorMessages, '; ');
                        output.put('actionErrors', errorDetailsList);
                    }
                    
                    output.put('success', false);
                    output.put('errorMessage', errorMessage);
                    
                    System.debug(LoggingLevel.ERROR, 'Rating Patch Invocable Action failed: ' + errorMessage);
                    return false;
                }
                
            } else {
                output.put('success', false);
                output.put('errorMessage', 'Rating Patch Invocable Action returned null or empty results');
                System.debug(LoggingLevel.WARN, 'Rating Patch Invocable Action returned null/empty results');
                return false;
            }
            
        } catch (Exception e) {
            String errorMsg = 'Exception: ' + e.getMessage();
            output.put('success', false);
            output.put('errorMessage', errorMsg);
            output.put('errorType', 'EXCEPTION');
            System.debug(LoggingLevel.ERROR, 'Exception while rating patch: ' + errorMsg);
            return false;
        }
    }
    
    private Object getValueFromMap(String key, Map<String, Object> inputs, Map<String, Object> options) {
        if (inputs != null && inputs.get(key) != null && String.isNotBlank(String.valueOf(inputs.get(key)))) {
            return inputs.get(key);
        }
        else if (options != null && options.get(key) != null && String.isNotBlank(String.valueOf(options.get(key)))) {
            return options.get(key);
        }
        
        return null;
    }
    
    private void setInvocationParameter(Invocable.Action action, Map<String, Object> payload, String inputAttribute, boolean serializeJSON) {
        if (payload.containsKey(inputAttribute) && payload.get(inputAttribute) != null) {
            System.debug(inputAttribute + ': ' + JSON.serialize(payload.get(inputAttribute)));
            if (serializeJSON) {
                action.setInvocationParameter(inputAttribute, JSON.serialize(payload.get(inputAttribute)));
            } else {
                action.setInvocationParameter(inputAttribute, payload.get(inputAttribute));
            }
        } else {
            System.debug('payload does not contain attribute: ' + inputAttribute);
        }
    }
}